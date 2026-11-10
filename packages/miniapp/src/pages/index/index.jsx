import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { View, Text, Button, RichText } from '@tarojs/components'
import {
  AtModal,
  AtModalHeader,
  AtModalContent,
  AtModalAction,
  AtToast,
} from 'taro-ui'

import {
  getArcadeDevices,
  getTcgPassOptions,
  bleConsumeCoin,
  remoteInsertCoin,
  uploadImage,
  updateUserProfile,
  uploadUrl,
} from '@/api'
import { authStore } from '@/stores/auth'
import { settingStore } from '@/stores/setting'
import { coinSdk, BLEError } from '@/utils/coin-sdk'
import { useToast } from '@/hooks/useToast'

import GamerProfileCard from './components/GamerProfileCard'
import ModeSwitcher from './components/ModeSwitcher'
import ArcadeConsole from './components/ArcadeConsole'
import CardPassSection from './components/CardPassSection'
import ProfileEditModal from './components/ProfileEditModal'

import './index.scss'

const DEFAULT_AVATAR = '/static/avatar.jpg'

export default function IndexPage() {
  const { toastProps, showLoading, showSuccess, showError, showText, hideToast } = useToast()
  const [user, setUser] = useState(authStore.user)
  const [available, setAvailable] = useState(authStore.available)

  // 双核模式：'arcade' (街机音游) | 'card' (卡牌通行证)
  const [activeMode, setActiveMode] = useState(settingStore.state.mainMode || 'arcade')

  useEffect(() => {
    return authStore.subscribe((state) => {
      setUser(state.user)
      setAvailable(state.available)
    })
  }, [])

  // 模式切换
  const handleSwitchMode = (mode) => {
    setActiveMode(mode)
    settingStore.setMainMode(mode)
    if (mode === 'card') {
      loadTcgStatus()
    } else {
      loadDevices()
    }
  }

  // 设备列表与选中状态 (街机模式)
  const [deviceList, setDeviceList] = useState([])
  const [pickerColumns, setPickerColumns] = useState([[], []])
  const [pickerValue, setPickerValue] = useState([0, 0])
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [selectedDevice, setSelectedDevice] = useState(null)

  // 个人资料修改弹窗
  const [profileModalVisible, setProfileModalVisible] = useState(false)
  const [profileAvatar, setProfileAvatar] = useState('')
  const [profileAvatarUrl, setProfileAvatarUrl] = useState('')
  const [profileNickname, setProfileNickname] = useState('')

  // 账号封禁弹窗
  const [banModalVisible, setBanModalVisible] = useState(false)
  const [banMsg, setBanMsg] = useState('')

  // 统一提示/确认弹窗
  const [dialogConfig, setDialogConfig] = useState({
    opened: false,
    title: '提示',
    content: '',
    confirmText: '确定',
    cancelText: '',
    onConfirm: null,
    onCancel: null,
  })

  const showDialog = ({
    title = '提示',
    content = '',
    confirmText = '确定',
    cancelText = '',
    onConfirm = null,
    onCancel = null,
  }) => {
    setDialogConfig({
      opened: true,
      title,
      content,
      confirmText,
      cancelText,
      onConfirm,
      onCancel,
    })
  }

  const closeDialog = () => {
    setDialogConfig((prev) => ({ ...prev, opened: false }))
  }

  const insertingRef = useRef(false)
  const isFirstShowRef = useRef(true)

  // 小程序版本信息
  const accountInfo = useMemo(() => {
    try {
      const info = Taro.getAccountInfoSync()
      return info?.miniProgram?.version || info?.miniProgram?.envVersion || ''
    } catch (e) {
      return ''
    }
  }, [])

  // 头像完整 URL
  const userAvatar = useMemo(() => {
    if (user && user.avatar) {
      return uploadUrl(user.avatar)
    }
    return DEFAULT_AVATAR
  }, [user])

  // 投币方式计算：0禁止 1余额 2时间
  const insertType = useMemo(() => {
    if (selectedDevice) {
      const arcadeDays = available.arcade_days ?? 0
      if (arcadeDays > 0 && selectedDevice.can_use_days) {
        return 2
      } else if (available.balance >= selectedDevice.price) {
        return 1
      }
    }
    return 0
  }, [selectedDevice, available])

  const insertSubText = useMemo(() => {
    if (!selectedDevice) return '请先选择机台'
    if (insertType === 2) return '本次投币免扣币'
    if (insertType === 1) return `扣除余额 ¥${selectedDevice.price} / ${selectedDevice.unit || '次'}`
    return `余额不足 (需要 ¥${selectedDevice.price})，请先充值`
  }, [insertType, selectedDevice])

  // 加载设备列表
  const loadDevices = useCallback(async () => {
    const res = await getArcadeDevices()
    if (!res || !res.length) return
    setDeviceList(res)

    const col0 = res.map((item) => item.name)
    const col1 = (res[0].devices || []).map((d) => d.name)
    setPickerColumns([col0, col1])

    const savedDeviceId = settingStore.state.device
    let matchedGroup = null
    let matchedDevice = null
    let matchedGroupIdx = 0
    let matchedDeviceIdx = 0

    res.forEach((group, gIdx) => {
      ;(group.devices || []).forEach((dev, dIdx) => {
        if (dev.id === savedDeviceId) {
          matchedGroup = group
          matchedDevice = dev
          matchedGroupIdx = gIdx
          matchedDeviceIdx = dIdx
        }
      })
    })

    if (matchedDevice) {
      setSelectedGroup(matchedGroup)
      setSelectedDevice(matchedDevice)
      setPickerValue([matchedGroupIdx, matchedDeviceIdx])
      setPickerColumns([col0, (matchedGroup.devices || []).map((d) => d.name)])
    } else {
      setSelectedGroup(res[0])
      setSelectedDevice(res[0].devices?.[0] || null)
      setPickerValue([0, 0])
    }
  }, [])

  // TCG 专区价格与状态提升至页面层（统一数据流与下拉等待）
  const [tcgPricing, setTcgPricing] = useState({ day_price: 15, month_price: 180 })
  const [tcgStatus, setTcgStatus] = useState({
    isActiveToday: false,
    hasMonthlyPass: false,
    tcgDays: 0,
  })

  // 加载 TCG 通行证与今日状态（支持 async/await 统一等待）
  const loadTcgStatus = useCallback(async () => {
    const res = await getTcgPassOptions()
    if (res) {
      if (res.day_price) {
        setTcgPricing({
          day_price: Number(res.day_price),
          month_price: Number(res.month_price),
        })
      }
      setTcgStatus({
        isActiveToday: Boolean(res.is_active_today),
        hasMonthlyPass: Boolean(res.has_monthly_pass),
        tcgDays: Number(res.tcg_days || 0),
      })
    }
    return res
  }, [])

  // 统一全量刷新：MUG 资产 + MUG 机台 + TCG 专区状态并行获取（任意接口失败均能穿透报错）
  const refreshAllData = useCallback(async () => {
    const results = await Promise.allSettled([
      authStore.refreshAvailable(),
      loadDevices(),
      loadTcgStatus(),
    ])
    const rejected = results.filter((r) => r.status === 'rejected')
    if (rejected.length > 0) {
      const firstErrMsg = rejected[0].reason?.message || '部分数据同步失败'
      throw new Error(firstErrMsg)
    }
  }, [loadDevices, loadTcgStatus])

  // 静默同步可用数据（用于初始加载与切前台）
  const silentRefresh = useCallback(async () => {
    try {
      await refreshAllData()
    } catch (e) {
      showError(e.message || '数据加载失败')
    }
  }, [refreshAllData, showError])

  // 初始化与登录
  useEffect(() => {
    async function init() {
      try {
        const currentUser = await authStore.login()
        if (currentUser?.is_ban) {
          setBanMsg(currentUser.ban_msg || '您的账号已被封禁')
          setBanModalVisible(true)
        } else {
          await silentRefresh()
        }
      } catch (e) {
        showError(e.message || '登录失败')
      }
    }
    init()

    const onRefreshEvent = () => {
      silentRefresh()
    }
    Taro.eventCenter.on('refreshData', onRefreshEvent)

    return () => {
      Taro.eventCenter.off('refreshData', onRefreshEvent)
    }
  }, [silentRefresh, showError])

  useDidShow(() => {
    if (isFirstShowRef.current) {
      isFirstShowRef.current = false
      return
    }
    if (authStore.token && !authStore.user?.is_ban) {
      silentRefresh()
    }
  })

  // 原生整页面下拉刷新：严格等待 MUG 资产、街机机台、TCG 状态全部完成，成功给出轻提示，失败明确弹窗
  usePullDownRefresh(async () => {
    try {
      await refreshAllData()
      showSuccess('刷新成功')
    } catch (e) {
      showError(e.message || '刷新失败')
    } finally {
      Taro.stopPullDownRefresh()
    }
  })

  // 多列联动选择设备
  const handlePickerColumnChange = (e) => {
    const { column, value } = e.detail
    if (column === 0) {
      const group = deviceList[value]
      if (group) {
        const nextCol1 = (group.devices || []).map((d) => d.name)
        setPickerColumns([pickerColumns[0], nextCol1])
        setPickerValue([value, 0])
      }
    } else if (column === 1) {
      setPickerValue([pickerValue[0], value])
    }
  }

  const handlePickerChange = (e) => {
    const [groupIdx, deviceIdx] = e.detail.value
    const group = deviceList[groupIdx]
    if (group && group.devices && group.devices[deviceIdx]) {
      const dev = group.devices[deviceIdx]
      setSelectedGroup(group)
      setSelectedDevice(dev)
      setPickerValue([groupIdx, deviceIdx])
      settingStore.setSelectedDeviceId(dev.id)
    }
  }

  // 蓝牙投币流程
  const insertCoinBLE = async (mac, number) => {
    try {
      await coinSdk.auth()
      await coinSdk.init()
      await coinSdk.connect(mac, 10)
      await coinSdk.coins(number)
    } finally {
      await coinSdk.destroy()
    }
  }

  // 点击投币
  const handleInsert = async () => {
    if (insertingRef.current || !selectedDevice || insertType <= 0) return

    insertingRef.current = true
    try {
      showLoading('正在投币中...')

      switch (selectedDevice.version) {
        case 1: // 蓝牙投币
          await authStore.refreshAvailable()
          if (insertType <= 0) {
            throw new Error('未达到投币条件')
          }
          await insertCoinBLE(selectedDevice.mac, selectedDevice.coin)
          await bleConsumeCoin(selectedDevice.id)
          break
        case 2: // MQTT投币
          await remoteInsertCoin(selectedDevice.id)
          break
        default:
          throw new Error('不支持的设备版本')
      }

      await authStore.refreshAvailable()
      showSuccess(insertType === 2 ? '畅玩投币成功 (免扣币)' : '投币成功！')
    } catch (e) {
      console.error(e)
      hideToast()
      const msg = e.message || e.errMsg || '投币失败'

      if (typeof msg === 'string' && msg.startsWith('authorize')) {
        showDialog({
          title: '权限提示',
          content: '投币功能需要使用蓝牙和定位权限！请点击确定打开权限设置。',
          cancelText: '取消',
          confirmText: '前往设置',
          onConfirm: () => {
            Taro.openSetting({
              success: (res) => {
                if (res.authSetting['scope.bluetooth'] && res.authSetting['scope.userLocation']) {
                  showSuccess('授权成功，请重试')
                } else {
                  showError('仍未开启必要权限')
                }
              },
            })
          },
        })
        return
      }

      if (e instanceof BLEError && e.type === BLEError.TYPE_NOT_AVAILABLE) {
        showDialog({
          title: '蓝牙未开启',
          content: '手机蓝牙未开启，请先打开手机系统蓝牙后重试！',
          confirmText: '我知道了',
        })
        return
      }

      showDialog({
        title: '投币提示',
        content: msg,
        confirmText: '我知道了',
      })
    } finally {
      insertingRef.current = false
    }
  }

  // 个人资料相关
  const handleChooseAvatar = async (e) => {
    const avatarUrl = e.detail.avatarUrl
    setProfileAvatarUrl(avatarUrl)
    showLoading('上传头像中...')
    try {
      const res = await uploadImage(avatarUrl)
      setProfileAvatar(res.file)
      showSuccess('头像已上传')
    } catch (err) {
      showError(err.message || '头像上传失败')
    }
  }

  const handleSaveProfile = async () => {
    if (!profileNickname.trim()) {
      showText('昵称不能为空')
      return
    }
    showLoading('保存资料中...')
    try {
      await updateUserProfile({
        nickname: profileNickname,
        avatar: profileAvatar,
      })
      await authStore.refreshUser()
      setProfileModalVisible(false)
      showSuccess('资料保存成功')
    } catch (e) {
      showError(e.message || '保存失败')
    }
  }

  const openProfileModal = () => {
    setProfileNickname(user?.nickname || '')
    setProfileAvatar(user?.avatar || '')
    setProfileAvatarUrl(user?.avatar ? uploadUrl(user.avatar) : DEFAULT_AVATAR)
    setProfileModalVisible(true)
  }

  const closeProfileModal = () => {
    setProfileModalVisible(false)
  }

  const handleExit = () => {
    Taro.exitMiniProgram()
  }

  return (
    <View className='page-index'>
      {/* 1. 玩家档案卡片 */}
      <GamerProfileCard
        user={user}
        available={available}
        userAvatar={userAvatar}
        onOpenProfile={openProfileModal}
      />

      {/* 2. 模式切换双核胶囊 (街机投币 ⟷ 卡牌通行证) */}
      {user && !user.is_ban && (
        <ModeSwitcher activeMode={activeMode} onSwitch={handleSwitchMode} />
      )}

      {/* 3. 模式 A: 街机音游投币 */}
      {user && !user.is_ban && activeMode === 'arcade' && (
        <ArcadeConsole
          selectedGroup={selectedGroup}
          selectedDevice={selectedDevice}
          pickerColumns={pickerColumns}
          pickerValue={pickerValue}
          onPickerChange={handlePickerChange}
          onPickerColumnChange={handlePickerColumnChange}
          insertType={insertType}
          insertSubText={insertSubText}
          onInsert={handleInsert}
          days={available?.arcade_days ?? 0}
        />
      )}

      {/* 4. 模式 B: 卡牌专区开台与通行 */}
      {user && !user.is_ban && activeMode === 'card' && (
        <CardPassSection
          user={user}
          available={available}
          pricing={tcgPricing}
          status={tcgStatus}
          onRefresh={loadTcgStatus}
          showDialog={showDialog}
          showLoading={showLoading}
          showSuccess={showSuccess}
          showError={showError}
        />
      )}

      {/* 5. 底部版本号信息 */}
      {accountInfo && (
        <View className='version-tag'>
          <Text>TERMINAL VERSION {accountInfo}</Text>
        </View>
      )}

      {/* 完善个人资料弹窗 */}
      <ProfileEditModal
        visible={profileModalVisible}
        nickname={profileNickname}
        avatarUrl={profileAvatarUrl}
        onClose={closeProfileModal}
        onNicknameChange={setProfileNickname}
        onChooseAvatar={handleChooseAvatar}
        onSave={handleSaveProfile}
      />

      {/* 账号封禁弹窗 */}
      <AtModal isOpened={banModalVisible} closeOnClickOverlay={false}>
        <AtModalHeader>账号状态提示</AtModalHeader>
        <AtModalContent>
          <View style={{ padding: '10px 0', textAlign: 'center', color: '#ff4757' }}>
            <RichText nodes={banMsg} />
          </View>
        </AtModalContent>
        <AtModalAction>
          <Button onClick={handleExit}>退出小程序</Button>
        </AtModalAction>
      </AtModal>

      {/* 统一通用提示/确认弹窗 */}
      <AtModal
        isOpened={dialogConfig.opened}
        closeOnClickOverlay={false}
        onClose={closeDialog}
      >
        {dialogConfig.title && <AtModalHeader>{dialogConfig.title}</AtModalHeader>}
        <AtModalContent>
          <View
            className='dialog-content-wrap'
            style={{
              textAlign: 'center',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px 0',
              boxSizing: 'border-box',
            }}
          >
            <Text
              className='dialog-content-text'
              style={{
                textAlign: 'center',
                width: '100%',
                display: 'block',
                lineHeight: '1.6',
                color: '#4a4a5a',
                fontSize: '15px',
              }}
            >
              {dialogConfig.content}
            </Text>
          </View>
        </AtModalContent>
        <AtModalAction>
          {dialogConfig.cancelText && (
            <Button
              onClick={() => {
                const cb = dialogConfig.onCancel
                closeDialog()
                cb?.()
              }}
            >
              {dialogConfig.cancelText}
            </Button>
          )}
          <Button
            onClick={() => {
              const cb = dialogConfig.onConfirm
              closeDialog()
              cb?.()
            }}
          >
            {dialogConfig.confirmText}
          </Button>
        </AtModalAction>
      </AtModal>

      {/* 统一通用轻提示与加载 */}
      <AtToast {...toastProps} />
    </View>
  )
}
