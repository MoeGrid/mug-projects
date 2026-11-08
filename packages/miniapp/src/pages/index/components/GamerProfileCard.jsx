import React from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'

export default function GamerProfileCard({
  user,
  available,
  userAvatar,
  onOpenProfile,
}) {
  if (!user) return null

  return (
    <View className='gamer-card'>
      <View className='gamer-header'>
        <View className='avatar-wrapper btn-press-effect' onClick={onOpenProfile}>
          <Image className='avatar-img' src={userAvatar} mode='aspectFill' />
          <View className='avatar-edit-badge'>✎</View>
        </View>

        <View className='info-wrapper'>
          <View className='nickname-row btn-press-effect' onClick={onOpenProfile}>
            <Text className='nickname-text'>{user?.nickname || '玩家'}</Text>
            <Text className='edit-pen'>✎</Text>
          </View>
          <View className='uid-tag'>
            <View className='dot' />
            <Text>UID {user?.id}</Text>
          </View>
        </View>

        {Boolean(user?.is_admin) && (
          <View
            className='admin-tag btn-press-effect'
            onClick={() => Taro.navigateTo({ url: '/pages/admin/index' })}
          >
            ⚙️ ADMIN
          </View>
        )}
      </View>

      {/* 资产面板 (仅展示全站通用账户余额与充值) */}
      <View className='gamer-assets'>
        <View
          className='asset-block btn-press-effect'
          onClick={() => Taro.navigateTo({ url: '/pages/index/record' })}
        >
          <View className='asset-label'>
            <Text>账户余额</Text>
            <Text className='arrow'>›</Text>
          </View>
          <View className='asset-value-wrap'>
            <Text className='symbol'>¥</Text>
            <Text className='value-num'>{available.balance || '0.00'}</Text>
          </View>
        </View>

        <View
          className='recharge-btn-mini btn-press-effect'
          onClick={() => Taro.navigateTo({ url: '/pages/index/buy' })}
        >
          <Text className='icon'>⚡</Text>
          <Text>充值</Text>
        </View>
      </View>
    </View>
  )
}
