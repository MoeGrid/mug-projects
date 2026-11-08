import React from 'react'
import { View, Text } from '@tarojs/components'

export default function ModeSwitcher({ activeMode, onSwitch }) {
  return (
    <View className='mode-switcher-container'>
      <View
        className={`mode-tab ${activeMode === 'arcade' ? 'active' : ''}`}
        onClick={() => onSwitch('arcade')}
      >
        <Text className='mode-icon'>🕹️</Text>
        <Text className='mode-title'>街机投币</Text>
        {activeMode === 'arcade' && <View className='active-pill' />}
      </View>
      <View
        className={`mode-tab ${activeMode === 'card' ? 'active' : ''}`}
        onClick={() => onSwitch('card')}
      >
        <Text className='mode-icon'>🎴</Text>
        <Text className='mode-title'>卡牌通行证</Text>
        {activeMode === 'card' && <View className='active-pill' />}
      </View>
    </View>
  )
}
