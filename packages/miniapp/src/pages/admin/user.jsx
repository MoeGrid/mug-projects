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
} from 'taro-ui'

import {
  adminGetUserDetail,
  adminUpdateUser,
  adminAdjustBalance,
  uploadUrl,
} from '@/api'
import { authStore } from '@/stores/auth'
import { useToast } from '@/hooks/useToast'

const defaultAvatar = '/static/avatar.jpg'

import './user.scss'

export default function AdminUserPage() {
  const { toastProps, showLoading, showSuccess, showError, hideToast } = useToast()
  const router = useRouter()
  const uid = router.params.id || 0

  const [currentTab, setCurrentTab] = useState(0)
  const [entity, setEntity] = useState(null)

  // 弹窗状态
  const [rechargeBalanceVisible, setRechargeBalanceVisible] = useState(false)
  const [rechargeDayVisible, setRechargeDayVisible] = useState(false)
  const [num1, setNum1] = useState('')
  const [num2, setNum2] = useState('')

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

  // 保存基本信息
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

  // 余额充值提交
  const doRechargeBalance = async () => {
    if (lockRef.current || !entity) return
    lockRef.current = true
    try {
      showLoading('处理中...')
      await adminAdjustBalance({
        id: entity.id,
        type: 1,
        num: Number(num1),
      })
      await loadData()
      setRechargeBalanceVisible(false)
      setNum1('')
      showSuccess('保存成功')
    } catch (e) {
      showError(e.message || '充值失败')
    } finally {
      lockRef.current = false
    }
  }

  // 天数充值提交
  const doRechargeDay = async () => {
    if (lockRef.current || !entity) return
    lockRef.current = true
    try {
      showLoading('处理中...')
      await adminAdjustBalance({
        id: entity.id,
        type: 2,
        num: Number(num2),
      })
      await loadData()
      setRechargeDayVisible(false)
      setNum2('')
      showSuccess('保存成功')
    } catch (e) {
      showError(e.message || '充值失败')
    } finally {
      lockRef.current = false
    }
  }

  if (!entity) return null

  return (
    <View className='page-admin-user'>
      {/* 顶部分栏选项卡 (AtTabs) */}
      <View className='tabs-wrap'>
        <AtTabs
          current={currentTab}
          tabList={[{ title: '基本信息' }, { title: '余额信息' }]}
          onClick={(idx) => setCurrentTab(idx)}
          swipeable={false}
        />
      </View>

      {/* Tab 1: 基本信息 */}
      {currentTab === 0 && (
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
              <AtAvatar size='small' image={entity.avatarUrl} />
            </View>
          </View>

          <View className='form-item'>
            <Text className='form-label'>昵称</Text>
            <View className='form-content'>
              <Text className='form-text'>{entity.nickname || '-'}</Text>
            </View>
          </View>

          <View className='form-item'>
            <Text className='form-label'>管理员</Text>
            <View className='form-content form-content-switch'>
              <Switch
                checked={Boolean(entity.is_admin)}
                color='#6190e8'
                onChange={(e) =>
                  setEntity((prev) => ({ ...prev, is_admin: e.detail.value ? 1 : 0 }))
                }
              />
            </View>
          </View>

          <View className='form-item'>
            <Text className='form-label'>封禁</Text>
            <View className='form-content form-content-switch'>
              <Switch
                checked={Boolean(entity.is_ban)}
                color='#ff4757'
                onChange={(e) =>
                  setEntity((prev) => ({ ...prev, is_ban: e.detail.value ? 1 : 0 }))
                }
              />
            </View>
          </View>

          <View className='form-item'>
            <Text className='form-label'>QQ</Text>
            <View className='form-content'>
              <Input
                className='form-input'
                placeholder='请输入QQ号'
                value={entity.qq || ''}
                onInput={(e) => setEntity((prev) => ({ ...prev, qq: e.detail.value }))}
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

          <View className='form-item form-item-textarea'>
            <Text className='form-label'>备注</Text>
            <View className='form-content textarea-content'>
              <AtTextarea
                value={entity.remark || ''}
                onChange={(val) => setEntity((prev) => ({ ...prev, remark: val }))}
                maxLength={200}
                placeholder='请输入备注信息'
              />
            </View>
          </View>

          <View className='submit-btn-wrap'>
            <AtButton type='primary' onClick={handleSave}>
              提交
            </AtButton>
          </View>
        </View>
      )}

      {/* Tab 2: 余额信息 */}
      {currentTab === 1 && (
        <View className='form-card'>
          <View className='form-item'>
            <Text className='form-label'>余额</Text>
            <View className='form-content'>
              <Text className='form-text form-highlight'>{entity.balance || 0} 元</Text>
            </View>
          </View>

          <View className='form-item'>
            <Text className='form-label'>音游畅玩天数</Text>
            <View className='form-content'>
              <Text className='form-text form-highlight'>{entity.arcade_days ?? 0} 天</Text>
            </View>
          </View>

          <View className='submit-btn-wrap'>
            <View className='action-btn-item'>
              <AtButton
                type='primary'
                onClick={() => setRechargeBalanceVisible(true)}
              >
                余额充值
              </AtButton>
            </View>
            <View className='action-btn-item'>
              <AtButton
                type='primary'
                onClick={() => setRechargeDayVisible(true)}
              >
                天数充值
              </AtButton>
            </View>
          </View>
        </View>
      )}

      {/* 余额充值弹窗 */}
      <AtModal
        isOpened={rechargeBalanceVisible}
        onClose={() => setRechargeBalanceVisible(false)}
      >
        <AtModalHeader>请输入充值数量</AtModalHeader>
        <AtModalContent>
          <View className='recharge-input-wrap'>
            <Input
              type='number'
              className='modal-input'
              placeholder='请输入充值数量'
              value={num1}
              onInput={(e) => setNum1(e.detail.value)}
            />
          </View>
        </AtModalContent>
        <AtModalAction>
          <Button onClick={() => setRechargeBalanceVisible(false)}>取消</Button>
          <Button onClick={doRechargeBalance}>确定</Button>
        </AtModalAction>
      </AtModal>

      {/* 天数充值弹窗 */}
      <AtModal
        isOpened={rechargeDayVisible}
        onClose={() => setRechargeDayVisible(false)}
      >
        <AtModalHeader>请输入充值天数</AtModalHeader>
        <AtModalContent>
          <View className='recharge-input-wrap'>
            <Input
              type='number'
              className='modal-input'
              placeholder='请输入充值天数'
              value={num2}
              onInput={(e) => setNum2(e.detail.value)}
            />
          </View>
        </AtModalContent>
        <AtModalAction>
          <Button onClick={() => setRechargeDayVisible(false)}>取消</Button>
          <Button onClick={doRechargeDay}>确定</Button>
        </AtModalAction>
      </AtModal>

      {/* 统一轻提示与加载 */}
      <AtToast {...toastProps} />
    </View>
  )
}
