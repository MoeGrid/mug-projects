import React from 'react'
import { View, Text, Picker } from '@tarojs/components'
import PassCard from './PassCard'

export default function ArcadeConsole({
  selectedGroup,
  selectedDevice,
  pickerColumns,
  pickerValue,
  onPickerChange,
  onPickerColumnChange,
  insertType,
  insertSubText,
  onInsert,
  days = 0,
}) {
  return (
    <>
      {/* 0. 内部特权通行证 MUG VIP PASS (仅在 days > 0 时对内展示) */}
      <PassCard
        title='MUG VIP PASS'
        subTitle='街机畅玩会员'
        watermark='VIP PASS'
        icon='⚡'
        days={days}
        mainDesc='全机台投币免扣余额'
        subDesc='尽情畅玩'
        showWhenZero={false}
      />

      {/* 1. 当前选中机台卡片 */}
      <Picker
        mode='multiSelector'
        range={pickerColumns}
        value={pickerValue}
        onChange={onPickerChange}
        onColumnChange={onPickerColumnChange}
      >
        <View className='cabinet-card btn-press-effect'>
          <View className='card-top-title'>
            <View className='cabinet-icon-row'>
              <View className='arcade-icon'>🎮</View>
              <Text className='title-text'>当前投币机台</Text>
            </View>
            <View className='switch-pill'>
              <Text>切换机台 ›</Text>
            </View>
          </View>

          <View className='cabinet-body'>
            <View className='group-name'>
              {selectedGroup ? selectedGroup.name : '未选择分区'}
            </View>
            <View className='machine-name-row'>
              <Text className='machine-name'>
                {selectedDevice ? selectedDevice.name : '点击选择机台'}
              </Text>
              {selectedDevice && (
                <View className='price-badge'>
                  <Text className='price-num'>¥{selectedDevice.price}</Text>
                  <Text className='price-unit'>/{selectedDevice.unit || '次'}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </Picker>

      {/* 2. 街机大投币键 */}
      <View className='insert-console'>
        <View
          className={`insert-button btn-press-effect ${
            insertType > 0 ? 'can-insert' : 'disabled'
          } ${insertType === 2 ? 'is-free-pass' : ''}`}
          onClick={onInsert}
        >
          <View className='insert-main-text'>
            <Text className='coin-icon'>{insertType === 2 ? '⚡' : '🪙'}</Text>
            <Text>{insertType === 2 ? '畅玩投币' : 'INSERT COIN 投币'}</Text>
          </View>
          <Text className='insert-sub-text'>{insertSubText}</Text>
        </View>
      </View>

      {/* 3. 音游机台到店须知卡片 */}
      <View className='rules-card arcade-rules-card'>
        <View className='rules-title'>
          <Text className='icon'>📖</Text>
          <Text>音游专区到店须知</Text>
        </View>
        <View className='rule-item'>
          <Text className='rule-badge'>离场注意</Text>
          <Text className='rule-text'>
            本店为无人值守空间，离开时若店内无其他人，请关闭所有机器、灯光、空调，并锁好大门。
          </Text>
        </View>
        <View className='rule-item'>
          <Text className='rule-badge'>排队轮候</Text>
          <Text className='rule-text'>
            有人等待时请自觉遵守一人一局轮换规则，投币前请确认机台空闲或与等待玩家礼貌交接。
          </Text>
        </View>
        <View className='rule-item'>
          <Text className='rule-badge'>爱护按键</Text>
          <Text className='rule-text'>
            机台按键与屏幕均为高灵敏精密外设，请勿用力敲击拍砸；佩戴戒指等硬物者请避免刮擦屏幕。
          </Text>
        </View>
      </View>
    </>
  )
}
