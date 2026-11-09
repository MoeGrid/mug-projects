import React from 'react'
import { View, Text } from '@tarojs/components'

/**
 * 通用畅玩通行凭证卡片（MUG 音游与 TCG 卡牌专区通用）
 */
export default function PassCard({
  title = 'MUG PASS',
  watermark = 'PASS',
  icon = '⚡',
  days = 0,
  mainDesc = '全场畅玩特权',
  subDesc = '畅玩免扣 · 尽情游玩',
  inactiveDesc = '暂未开通畅玩通行',
  inactiveSubDesc = '按需充值天数 · 每天统一早 06:00 结算',
  showWhenZero = false,
  className = '',
}) {
  const isValid = Number(days) > 0

  if (!isValid && !showWhenZero) {
    return null
  }

  return (
    <View className={`mug-arc-pass-card ${isValid ? '' : 'pass-inactive'} ${className}`}>
      {isValid && <View className='hologram-shimmer' />}
      <View className='card-watermark'>{watermark}</View>
      <View className='pass-inner'>
        <View className='pass-top'>
          <View className='pass-brand'>
            <Text className='brand-icon'>{icon}</Text>
            <Text className='brand-title'>{title}</Text>
          </View>
          <View className={`pass-status ${isValid ? '' : 'inactive-status'}`}>
            {isValid && <View className='pulse-dot' />}
            <Text>{isValid ? '畅玩生效中' : '未激活'}</Text>
          </View>
        </View>

        <View className='pass-content'>
          <View className='privilege-desc'>
            <Text className='desc-main'>{isValid ? mainDesc : inactiveDesc}</Text>
            <Text className='desc-sub'>{isValid ? subDesc : inactiveSubDesc}</Text>
          </View>

          {isValid && (
            <View className='days-wrap'>
              <Text className='days-num'>{days}</Text>
              <Text className='days-unit'>天剩余</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  )
}
