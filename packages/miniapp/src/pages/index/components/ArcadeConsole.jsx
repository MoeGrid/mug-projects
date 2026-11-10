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
      {/* 0. 内部特权通行证 MUG ARC PASS (仅在 days > 0 时对内展示) */}
      <PassCard
        title='MUG ARC PASS'
        subTitle='街机畅玩会员'
        watermark='ARC PASS'
        icon='⚡'
        days={days}
        mainDesc='全机台投币免扣余额'
        subDesc='直接刷卡投币 · 尽情畅玩'
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
          <Text className='rule-badge'>排队轮候</Text>
          <Text className='rule-text'>
            有人等待时请自觉遵守一人一币轮换规则，投币前请确认机台空闲或与等待玩家礼貌交接。
          </Text>
        </View>
        <View className='rule-item'>
          <Text className='rule-badge'>爱护按键</Text>
          <Text className='rule-text'>
            机台按键与屏幕均为高灵敏精密外设，请勿用力敲击拍砸；佩戴戒指等硬物者请避免刮擦屏幕。
          </Text>
        </View>
        <View className='rule-item'>
          <Text className='rule-badge'>手套防护</Text>
          <Text className='rule-text'>
            触屏与滑键音游（如 maimai 等）建议佩戴白手套游玩；前台备有消毒湿巾与酒精，欢迎随时取用。
          </Text>
        </View>
        <View className='rule-item'>
          <Text className='rule-badge'>耳机插孔</Text>
          <Text className='rule-text'>
            机台支持 3.5mm 标准耳机插孔，建议自备耳机获得更佳听感；离场时请随身带好手机、卡包等随身财物。
          </Text>
        </View>
      </View>
    </>
  )
}
