import React from 'react'
import { View, Text } from '@tarojs/components'
import './PassCard.scss'

/**
 * 通用尊享 VIP PASS 通行卡片（MUG 音游与 TCG 卡牌专区统一金黄黑金风格）
 */
export default function PassCard({
  title = 'VIP PASS',
  subTitle = '',
  watermark = 'VIP PASS',
  icon = '👑',
  days = 0,
  statusText = '特权生效中',
  daysUnit = '天剩余',
  mainDesc = '全场畅玩特权',
  subDesc = '',
  showWhenZero = false,
  className = '',
}) {
  const isValid = Number(days) > 0

  if (!isValid && !showWhenZero) {
    return null
  }

  return (
    <View className={`common-vip-pass-card ${className}`}>
      <View className='vip-shimmer' />
      <View className='vip-watermark'>{watermark}</View>
      <View className='vip-header'>
        <View className='vip-brand'>
          <Text className='vip-crown'>{icon}</Text>
          <View className='vip-brand-text'>
            <Text className='vip-brand-title'>{title}</Text>
            {subTitle ? <Text className='vip-brand-sub'>{subTitle}</Text> : null}
          </View>
        </View>
        <View className='vip-status-badge'>
          <View className='pulse-gold-dot' />
          <Text>{statusText}</Text>
        </View>
      </View>

      <View className='vip-body'>
        <View className='vip-privilege-info'>
          <Text className='privilege-highlight'>{mainDesc}</Text>
          {subDesc ? <Text className='privilege-detail'>{subDesc}</Text> : null}
        </View>

        <View className='vip-days-box'>
          <Text className='days-val'>{days}</Text>
          <Text className='days-unit'>{daysUnit}</Text>
        </View>
      </View>
    </View>
  )
}
