import React from 'react'
import { View, Button, Input, Image } from '@tarojs/components'
import { AtModal, AtModalHeader, AtModalContent, AtModalAction } from 'taro-ui'

const DEFAULT_AVATAR = '/static/avatar.jpg'

export default function ProfileEditModal({
  visible,
  nickname,
  avatarUrl,
  onClose,
  onNicknameChange,
  onChooseAvatar,
  onSave,
}) {
  // 未激活展示时彻底卸载，避免 iOS 下原生 Input 组件 placeholder 穿透显示在首页
  if (!visible) return null

  return (
    <AtModal isOpened={visible} onClose={onClose} closeOnClickOverlay={false}>
      <AtModalHeader>编辑玩家档案</AtModalHeader>
      <AtModalContent>
        <View className='profile-modal-content'>
          <Button
            className='avatar-upload-btn btn-press-effect'
            openType='chooseAvatar'
            onChooseAvatar={onChooseAvatar}
          >
            <Image
              className='modal-avatar-img'
              src={avatarUrl || DEFAULT_AVATAR}
              mode='aspectFill'
            />
            <View className='upload-tip'>更换</View>
          </Button>

          <View className='nickname-box'>
            <Input
              type='nickname'
              className='nickname-input'
              placeholder='请输入玩家昵称'
              value={nickname}
              onInput={(e) => onNicknameChange(e.detail.value)}
              onBlur={(e) => onNicknameChange(e.detail.value)}
            />
          </View>
        </View>
      </AtModalContent>
      <AtModalAction>
        <Button onClick={onClose}>取消</Button>
        <Button onClick={onSave}>保存</Button>
      </AtModalAction>
    </AtModal>
  )
}
