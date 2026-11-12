import React, { useState, useEffect, useCallback } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Button, Input, Image } from '@tarojs/components'
import { AtToast, AtTag } from 'taro-ui'

import {
  getUserProfile,
  updateUserProfile,
  getUserFaceStatus,
  registerUserFace,
  deleteUserFace,
  uploadImage,
  uploadUrl,
} from '@/api'
import { authStore } from '@/stores/auth'
import { useToast } from '@/hooks/useToast'

import './profile.scss'

const DEFAULT_AVATAR = '/static/avatar.jpg'

export default function ProfilePage() {
  const { toastProps, showLoading, showSuccess, showError, hideToast } = useToast()

  const [user, setUser] = useState(authStore.user)
  const [nickname, setNickname] = useState('')
  const [avatar, setAvatar] = useState('')
  const [avatarUrl, setAvatarUrl] = useState(DEFAULT_AVATAR)

  // 人脸状态: { registered: boolean, face_count: number, updated_at?: string }
  const [faceStatus, setFaceStatus] = useState({
    registered: false,
    face_count: 0,
    updated_at: null,
  })
  const [faceLoading, setFaceLoading] = useState(false)

  // 加载资料与人脸状态
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

      const face = await getUserFaceStatus()
      if (face) {
        setFaceStatus(face)
      }
      hideToast()
    } catch (e) {
      showError(e.message || '加载资料失败')
    }
  }, [showLoading, hideToast, showError])

  useEffect(() => {
    loadData()
  }, [loadData])

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

  // 录入 / 更新人脸
  const handleRegisterFace = async () => {
    try {
      const res = await Taro.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['camera', 'album'],
        camera: 'front',
      })

      const tempFile = res.tempFiles?.[0]?.tempFilePath
      if (!tempFile) return

      setFaceLoading(true)
      showLoading('人脸检测与录入中...')

      const result = await registerUserFace(tempFile)
      showSuccess(result.message || '人脸录入成功')

      // 重新拉取人脸状态
      const newStatus = await getUserFaceStatus()
      setFaceStatus(newStatus || { registered: true, face_count: 1 })
    } catch (e) {
      const msg = e?.errMsg || e?.message || ''
      if (typeof msg === 'string' && msg.includes('cancel')) {
        return
      }
      showError(e.message || '人脸录入失败')
    } finally {
      setFaceLoading(false)
    }
  }

  // 注销人脸
  const handleDeleteFace = () => {
    Taro.showModal({
      title: '确认注销人脸',
      content: '注销后将无法使用人脸识别门禁进店，确认注销吗？',
      confirmColor: '#ff4d4f',
      success: async (res) => {
        if (!res.confirm) return
        try {
          showLoading('注销中...')
          await deleteUserFace()
          setFaceStatus({ registered: false, face_count: 0, updated_at: null })
          showSuccess('人脸档案已注销')
        } catch (e) {
          showError(e.message || '注销失败')
        }
      },
    })
  }

  const formatTime = (isoStr) => {
    if (!isoStr) return ''
    try {
      const d = new Date(isoStr)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    } catch {
      return isoStr
    }
  }

  return (
    <View className='page-profile'>
      {/* 头部个人基本资料卡片 */}
      <View className='profile-hero-card'>
        <View className='avatar-wrapper'>
          <Button
            className='avatar-button btn-press-effect'
            openType='chooseAvatar'
            onChooseAvatar={handleChooseAvatar}
          >
            <Image className='avatar-img' src={avatarUrl} mode='aspectFill' />
            <View className='camera-badge'>
              <Text className='camera-icon'>📷</Text>
            </View>
          </Button>
          <Text className='avatar-hint'>点击更换头像</Text>
        </View>

        <View className='user-meta-row'>
          <Text className='uid-badge'>UID: {user?.id || '-'}</Text>
          {Boolean(user?.is_admin) && (
            <AtTag size='small' circle customStyle={{ backgroundColor: '#ff9900', color: '#fff' }}>
              管理员
            </AtTag>
          )}
        </View>
      </View>

      {/* 昵称及保存表单 */}
      <View className='section-card'>
        <View className='card-title-row'>
          <Text className='card-title'>基本信息</Text>
        </View>

        <View className='form-item'>
          <Text className='form-label'>玩家昵称</Text>
          <View className='input-wrap'>
            <Input
              type='nickname'
              className='form-input'
              placeholder='请输入玩家昵称'
              value={nickname}
              onInput={(e) => setNickname(e.detail.value)}
              onBlur={(e) => setNickname(e.detail.value)}
            />
          </View>
        </View>

        <View className='action-row'>
          <View className='btn-save btn-press-effect' onClick={handleSaveProfile}>
            <Text>保存基本资料</Text>
          </View>
        </View>
      </View>

      {/* 人脸注册通行卡片 */}
      <View className='section-card face-card'>
        <View className='card-title-row'>
          <View className='title-with-icon'>
            <Text className='face-icon'>👁️</Text>
            <Text className='card-title'>人脸识别通行档案</Text>
          </View>

          {faceStatus.registered ? (
            <View className='status-pill active'>
              <Text className='status-dot'>●</Text>
              <Text className='status-text'>已录入</Text>
            </View>
          ) : (
            <View className='status-pill inactive'>
              <Text className='status-dot'>●</Text>
              <Text className='status-text'>未录入</Text>
            </View>
          )}
        </View>

        <Text className='card-desc'>
          录人人脸档案后，可用于无人值守门店人脸识别门禁及进店快速通行验证。
        </Text>

        {/* 拍摄指引贴士 */}
        <View className='guidelines-box'>
          <Text className='guide-header'>💡 录入要求：</Text>
          <View className='guide-item'>
            <Text className='guide-bullet'>·</Text>
            <Text className='guide-text'>保持正对镜头，面部完整清晰无遮挡；</Text>
          </View>
          <View className='guide-item'>
            <Text className='guide-bullet'>·</Text>
            <Text className='guide-text'>光线明亮均匀，避免背光或过暗环境；</Text>
          </View>
          <View className='guide-item'>
            <Text className='guide-bullet'>·</Text>
            <Text className='guide-text'>请勿佩戴帽子、口罩或墨镜等饰品。</Text>
          </View>
        </View>

        {/* 已录入信息展示 */}
        {faceStatus.registered && faceStatus.updated_at && (
          <View className='face-meta-info'>
            <Text className='meta-label'>最后同步时间：</Text>
            <Text className='meta-val'>{formatTime(faceStatus.updated_at)}</Text>
          </View>
        )}

        {/* 操作按钮组 */}
        <View className='face-actions-wrap'>
          {!faceStatus.registered ? (
            <View
              className='btn-face-primary btn-press-effect'
              onClick={handleRegisterFace}
            >
              <Text className='btn-text'>📸 立即录入人脸</Text>
            </View>
          ) : (
            <View className='dual-actions-row'>
              <View
                className='btn-face-secondary btn-press-effect'
                onClick={handleRegisterFace}
              >
                <Text className='btn-text'>🔄 重新采集人脸</Text>
              </View>
              <View
                className='btn-face-danger btn-press-effect'
                onClick={handleDeleteFace}
              >
                <Text className='btn-text'>注销人脸</Text>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* 统一提示 */}
      <AtToast {...toastProps} />
    </View>
  )
}
