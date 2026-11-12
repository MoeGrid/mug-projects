import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from '@tarojs/taro'
import { View, Text, Button, Input, Switch } from '@tarojs/components'
import {
  AtTabs,
  AtAvatar,
  AtTextarea,
  AtButton,
  AtModal,
  AtModalHeader,
  AtModalContent,
  AtModalAction,
  AtToast,
  AtTag,
} from 'taro-ui'

import {
  adminGetUserDetail,
  adminUpdateUser,
  adminAdjustBalance,
  uploadUrl,
} from '@/api'
import { authStore } from '@/stores/auth'
import { useToast } from '@/hooks/useToast'

import './user.scss'

const defaultAvatar = '/static/avatar.jpg'

export default function AdminUserPage() {
  const { toastProps, showLoading, showSuccess, showError, hideToast } = useToast()
  const router = useRouter()
  const uid = router.params.id || 0

  const [currentTab, setCurrentTab] = useState(0)
  const [entity, setEntity] = useState(null)

  // 调配弹窗状态: modalType = 1 (余额) | 2 (MUG天数) | 3 (TCG月卡天数) | null
  const [modalType, setModalType] = useState(null)
  const [adjustVal, setAdjustVal] = useState('')
  const lockRef = useRef(false)

  const loadData = useCallback(async () => {
    try {
      showLoading('加载中...')
      const u = await adminGetUserDetail(uid)
      if (!u) {
        throw new Error('未找到该用户!')
      }
      u.avatarUrl = u.avatar ? uploadUrl(u.avatar) : defaultAvatar
      setEntity(u)
      hideToast()
    } catch (e) {
      showError(e.message || '查找失败')
    }
  }, [uid, showLoading, showError, hideToast])

  useEffect(() => {
    async function init() {
      await authStore.login()
      await loadData()
    }
    init()
  }, [loadData])

  // 保存用户基本资料
  const handleSave = async () => {
    if (!entity) return
    try {
      showLoading('保存中...')
      await adminUpdateUser(entity)
      await loadData()
      showSuccess('保存成功')
    } catch (e) {
      showError(e.message || '保存失败')
    }
  }

  // 打开调配弹窗
  const openAdjustModal = (type) => {
    setModalType(type)
    setAdjustVal('')
  }

  // 关闭弹窗
  const closeAdjustModal = () => {
    setModalType(null)
    setAdjustVal('')
  }

  // 提交调配
  const doAdjust = async () => {
    if (lockRef.current || !entity || !modalType) return
    const num = Number(adjustVal)
    if (Number.isNaN(num) || num === 0) {
      showError('请输入非0的调配数值')
      return
    }
    if ((modalType === 2 || modalType === 3) && !Number.isInteger(num)) {
      showError('天数必须是整数')
      return
    }

    lockRef.current = true
    try {
      showLoading('处理中...')
      await adminAdjustBalance({
        id: entity.id,
        type: modalType,
        num,
      })
      await loadData()
      closeAdjustModal()
      showSuccess('调配成功')
    } catch (e) {
      showError(e.message || '调配失败')
    } finally {
      lockRef.current = false
    }
  }

  if (!entity) return null

  return (
    <View className='page-admin-user'>
      {/* 顶部分栏选项卡 */}
      <View className='tabs-wrap'>
        <AtTabs
          current={currentTab}
          tabList={[{ title: '💳 资产调配' }, { title: '👤 基本信息' }]}
          onClick={(idx) => setCurrentTab(idx)}
          swipeable={false}
        />
      </View>

      {/* Tab 0: 资产调配 */}
      {currentTab === 0 && (
        <View className='asset-section'>
          {/* 用户概览头 */}
          <View className='user-summary-card'>
            <AtAvatar size='normal' image={entity.avatarUrl} circle />
            <View className='summary-info'>
              <View className='title-row'>
                <Text className='nickname'>{entity.nickname || '玩家'}</Text>
                <AtTag size='small' type='primary' circle>{`UID: ${entity.id}`}</AtTag>
              </View>
              {entity.phone && <Text className='phone'>手机: {entity.phone}</Text>}
            </View>
          </View>

          {/* 资产 1: 账户余额 */}
          <View className='asset-card'>
            <View className='card-left'>
              <Text className='asset-name'>💰 账户余额</Text>
              <Text className='asset-val'>¥{entity.balance || 0}</Text>
              <Text className='asset-sub'>用于街机投币与TCG开通畅玩扣费</Text>
            </View>
            <View className='card-right'>
              <AtButton
                size='small'
                type='primary'
                onClick={() => openAdjustModal(1)}
              >
                加减余额
              </AtButton>
            </View>
          </View>

          {/* 资产 2: 街机 MUG 畅玩 */}
          <View className='asset-card'>
            <View className='card-left'>
              <View className='title-with-tag'>
                <Text className='asset-name'>🎵 音游 MUG 畅玩</Text>
                {entity.arcade_days > 0 ? (
                  <AtTag size='small' circle customStyle={{ backgroundColor: '#10b981', color: '#fff' }}>
                    生效中
                  </AtTag>
                ) : (
                  <AtTag size='small' circle customStyle={{ backgroundColor: '#94a3b8', color: '#fff' }}>
                    未开通
                  </AtTag>
                )}
              </View>
              <Text className='asset-val'>{entity.arcade_days ?? 0} 天</Text>
              <Text className='asset-sub'>
                到期时间: {entity.arcade_expire_date || '无'}
              </Text>
            </View>
            <View className='card-right'>
              <AtButton
                size='small'
                type='primary'
                onClick={() => openAdjustModal(2)}
              >
                加减天数
              </AtButton>
            </View>
          </View>

          {/* 资产 3: 卡牌 TCG PASS */}
          <View className='asset-card'>
            <View className='card-left'>
              <View className='title-with-tag'>
                <Text className='asset-name'>🃏 卡牌 TCG PASS</Text>
                {entity.tcg_days > 0 ? (
                  <AtTag size='small' circle customStyle={{ backgroundColor: '#f59e0b', color: '#fff' }}>
                    生效中
                  </AtTag>
                ) : (
                  <AtTag size='small' circle customStyle={{ backgroundColor: '#94a3b8', color: '#fff' }}>
                    未开通
                  </AtTag>
                )}
              </View>
              <Text className='asset-val'>{entity.tcg_days ?? 0} 天</Text>
              <Text className='asset-sub'>
                到期时间: {entity.tcg_expire_date || '无'}
              </Text>
            </View>
            <View className='card-right'>
              <AtButton
                size='small'
                type='primary'
                onClick={() => openAdjustModal(3)}
              >
                加减天数
              </AtButton>
            </View>
          </View>
        </View>
      )}

      {/* Tab 1: 基本信息 */}
      {currentTab === 1 && (
        <View className='form-card'>
          <View className='form-item'>
            <Text className='form-label'>UID</Text>
            <View className='form-content'>
              <Text className='form-text'>{entity.id}</Text>
            </View>
          </View>

          <View className='form-item'>
            <Text className='form-label'>头像</Text>
            <View className='form-content'>
              <AtAvatar size='small' image={entity.avatarUrl} circle />
            </View>
          </View>

          <View className='form-item'>
            <Text className='form-label'>微信昵称</Text>
            <View className='form-content'>
              <Text className='form-text'>{entity.nickname || '-'}</Text>
            </View>
          </View>

          <View className='form-item'>
            <Text className='form-label'>管理员权限</Text>
            <View className='form-content form-content-switch'>
              <Switch
                checked={Boolean(entity.is_admin)}
                color='#3b82f6'
                onChange={(e) =>
                  setEntity((prev) => ({ ...prev, is_admin: e.detail.value ? 1 : 0 }))
                }
              />
            </View>
          </View>

          <View className='form-item'>
            <Text className='form-label'>封禁账号</Text>
            <View className='form-content form-content-switch'>
              <Switch
                checked={Boolean(entity.is_ban)}
                color='#ef4444'
                onChange={(e) =>
                  setEntity((prev) => ({ ...prev, is_ban: e.detail.value ? 1 : 0 }))
                }
              />
            </View>
          </View>

          <View className='form-item'>
            <Text className='form-label'>手机号</Text>
            <View className='form-content'>
              <Input
                className='form-input'
                placeholder='请输入手机号'
                value={entity.phone || ''}
                onInput={(e) => setEntity((prev) => ({ ...prev, phone: e.detail.value }))}
              />
            </View>
          </View>

          <View className='form-item'>
            <Text className='form-label'>QQ号</Text>
            <View className='form-content'>
              <Input
                className='form-input'
                placeholder='请输入QQ号'
                value={entity.qq || ''}
                onInput={(e) => setEntity((prev) => ({ ...prev, qq: e.detail.value }))}
              />
            </View>
          </View>

          <View className='form-item form-item-textarea'>
            <Text className='form-label'>管理备注</Text>
            <View className='form-content textarea-content'>
              <AtTextarea
                value={entity.remark || ''}
                onChange={(val) => setEntity((prev) => ({ ...prev, remark: val }))}
                maxLength={200}
                placeholder='添加管理备注（如常来常驻会员等）'
              />
            </View>
          </View>

          <View className='submit-btn-wrap'>
            <AtButton type='primary' onClick={handleSave}>
              保存资料修改
            </AtButton>
          </View>
        </View>
      )}

      {/* 资产加减调配弹窗（条件渲染，避免 iOS 下隐藏状态时 Input 穿透） */}
      {modalType !== null && (
        <AtModal
          isOpened
          onClose={closeAdjustModal}
        >
          <AtModalHeader>
            {modalType === 1 && '调配账户余额 (元)'}
            {modalType === 2 && '调配 MUG 畅玩天数'}
            {modalType === 3 && '调配 TCG PASS 天数'}
          </AtModalHeader>
          <AtModalContent>
            <View className='modal-adjust-body'>
              <Text className='modal-tip'>
                {modalType === 1 && '输入正数加款，输入负数扣款（如 50 或 -20）'}
                {modalType === 2 && '输入正数加天数，输入负数减天数（如 30 或 -7）'}
                {modalType === 3 && '输入正数加天数，输入负数减天数（如 30 或 -7）'}
              </Text>

              <View className='input-row'>
                <Input
                  type='text'
                  className='modal-input'
                  placeholder='请输入数值（正数加，负数减）'
                  value={adjustVal}
                  onInput={(e) => setAdjustVal(e.detail.value)}
                />
              </View>
            </View>
          </AtModalContent>
          <AtModalAction>
            <Button onClick={closeAdjustModal}>取消</Button>
            <Button onClick={doAdjust}>确认调配</Button>
          </AtModalAction>
        </AtModal>
      )}

      {/* 统一轻提示 */}
      <AtToast {...toastProps} />
    </View>
  )
}
