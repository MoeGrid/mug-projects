import React, { useState, useEffect, useCallback } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Button, Input, Image } from '@tarojs/components'
import { AtToast, AtTag } from 'taro-ui'

import {
  getUserProfile,
  updateUserProfile,
  uploadImage,
  uploadUrl,
} from '@/api'
import { authStore } from '@/stores/auth'
import { useToast } from '@/hooks/useToast'
import PrivacyPopup from '@/components/PrivacyPopup'

import './profile.scss'

const DEFAULT_AVATAR = '/static/avatar.jpg'

export default function ProfilePage() {
  const { toastProps, showLoading, showSuccess, showError, hideToast } = useToast()

  const [user, setUser] = useState(authStore.user)
  const [nickname, setNickname] = useState('')
  const [avatar, setAvatar] = useState('')
  const [avatarUrl, setAvatarUrl] = useState(DEFAULT_AVATAR)
  const [needPrivacyAuth, setNeedPrivacyAuth] = useState(false)
  const [nicknameFocus, setNicknameFocus] = useState(false)

  // 加载资料
  const loadData = useCallback(async () => {
    try {
      showLoading('加载中...')
      await authStore.login()
      const u = await getUserProfile()
      if (u) {
        setUser(u)
        setNickname(u.nickname || '')
        setAvatar(u.avatar || '')
        setAvatarUrl(u.avatar ? uploadUrl(u.avatar) : DEFAULT_AVATAR)
        authStore.setUser({ ...authStore.user, ...u })
      }
      hideToast()
    } catch (e) {
      showError(e.message || '加载资料失败')
    }
  }, [showLoading, hideToast, showError])

  // 检查微信隐私协议授权状态
  const checkPrivacySetting = useCallback(() => {
    if (typeof Taro.getPrivacySetting === 'function') {
      Taro.getPrivacySetting({
        success: (res) => {
          setNeedPrivacyAuth(Boolean(res.needAuthorization))
        },
      })
    }
  }, [])

  useEffect(() => {
    loadData()
    checkPrivacySetting()
  }, [loadData, checkPrivacySetting])

  // 点击昵称区域：未授权时通过用户手势主动拉起隐私弹窗
  const handleNicknameTap = () => {
    if (needPrivacyAuth && typeof Taro.requirePrivacyAuthorize === 'function') {
      Taro.requirePrivacyAuthorize({
        success: () => {
          setNeedPrivacyAuth(false)
          setTimeout(() => setNicknameFocus(true), 250)
        },
      })
    }
  }

  // 隐私授权同意后的统一解锁回调
  const handlePrivacyAgree = () => {
    setNeedPrivacyAuth(false)
    setTimeout(() => setNicknameFocus(true), 250)
  }

  // 微信快捷选择头像
  const handleChooseAvatar = async (e) => {
    const { avatarUrl: tempPath } = e.detail || {}
    if (!tempPath) return

    try {
      showLoading('上传头像中...')
      const relPath = await uploadImage(tempPath)
      setAvatar(relPath)
      setAvatarUrl(uploadUrl(relPath))
      hideToast()
    } catch (err) {
      showError(err.message || '上传头像失败')
    }
  }

  // 保存基础资料（头像和昵称）
  const handleSaveProfile = async () => {
    const trimmed = (nickname || '').trim()
    if (!trimmed) {
      showError('请输入玩家昵称')
      return
    }
    if (!avatar) {
      showError('请先上传头像')
      return
    }

    try {
      showLoading('保存中...')
      const updated = await updateUserProfile({
        nickname: trimmed,
        avatar,
      })
      if (updated) {
        setUser(updated)
        authStore.setUser({ ...authStore.user, ...updated })
      }
      Taro.eventCenter.trigger('refreshData')
      showSuccess('个人资料保存成功')
    } catch (e) {
      showError(e.message || '保存失败')
    }
  }

  return (
    <View className='page-profile'>
      {/* 玩家基本信息卡片（头像、昵称与保存一体化） */}
      <View className='section-card base-profile-card'>
        <View className='card-title-row'>
          <Text className='card-title'>基本信息</Text>
          <View className='user-meta-row'>
            <Text className='uid-badge'>UID: {user?.id || '-'}</Text>
            {Boolean(user?.is_admin) && (
              <AtTag size='small' circle customStyle={{ backgroundColor: '#ff9900', color: '#fff' }}>
                管理员
              </AtTag>
            )}
          </View>
        </View>

        {/* 头像更换 */}
        <View className='avatar-upload-section'>
          <Button
            className='avatar-button btn-press-effect'
            openType='chooseAvatar'
            onChooseAvatar={handleChooseAvatar}
          >
            <Image className='avatar-img' src={avatarUrl} mode='aspectFill' />
          </Button>
          <Text className='avatar-hint'>点击更换头像</Text>
        </View>

        {/* 昵称编辑 */}
        <View className='form-item'>
          <Text className='form-label'>玩家昵称</Text>
          <View className='input-wrap'>
            {needPrivacyAuth && (
              <View className='privacy-touch-mask' onClick={handleNicknameTap} />
            )}
            <Input
              type='nickname'
              className='form-input'
              placeholder='请输入玩家昵称'
              value={nickname}
              focus={nicknameFocus}
              onInput={(e) => setNickname(e.detail.value)}
              onBlur={(e) => {
                setNickname(e.detail.value)
                setNicknameFocus(false)
              }}
            />
          </View>
        </View>

        {/* 统一保存按钮 */}
        <View className='action-row'>
          <View className='btn-save btn-press-effect' onClick={handleSaveProfile}>
            <Text>保存基本资料</Text>
          </View>
        </View>
      </View>

      {/* 统一提示 */}
      <AtToast {...toastProps} />

      {/* 微信隐私协议授权弹窗 */}
      <PrivacyPopup onAgree={handlePrivacyAgree} />
    </View>
  )
}
