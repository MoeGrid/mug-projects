import React, { useState, useEffect, useRef } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Input } from '@tarojs/components'
import { AtToast } from 'taro-ui'

import { eventList, buyRecharge, buyEvent } from '@/api/api'
import { authStore } from '@/stores/auth'
import { useToast } from '@/hooks/useToast'

import './buy.scss'

const PRESET_AMOUNTS = [10, 20, 50, 100, 200, 500]

export default function BuyPage() {
  const { toastProps, showLoading, showSuccess, showError, showText, hideToast } = useToast()
  const [available, setAvailable] = useState(authStore.available)
  const [num, setNum] = useState('50')
  const [selectedPreset, setSelectedPreset] = useState(50)
  const [events, setEvents] = useState([])
  const payingRef = useRef(false)

  // 监听账户余额变动
  useEffect(() => {
    return authStore.subscribe((state) => {
      setAvailable(state.available)
    })
  }, [])

  // 加载活动列表
  useEffect(() => {
    async function init() {
      await authStore.login()
      try {
        showLoading('加载优惠活动...')
        const list = await eventList()
        setEvents(list || [])
        hideToast()
      } catch (e) {
        showError(e.message || '加载活动失败')
      }
    }
    init()

    return () => {
      Taro.eventCenter.trigger('refreshData')
    }
  }, [showLoading, showError, hideToast])

  // 点击快捷面额
  const handleSelectPreset = (val) => {
    setSelectedPreset(val)
    setNum(String(val))
  }

  // 输入框输入（仅允许整数）
  const handleInputChange = (e) => {
    let val = e.detail.value || ''
    // 过滤所有非纯数字（禁止小数点及负号等）
    val = val.replace(/\D/g, '')
    // 去除前导0
    if (val.length > 1 && val.startsWith('0')) {
      val = val.replace(/^0+/, '')
    }
    setNum(val)
    const asNum = parseInt(val, 10)
    if (PRESET_AMOUNTS.includes(asNum)) {
      setSelectedPreset(asNum)
    } else {
      setSelectedPreset(null)
    }
    return val
  }

  // 余额自定义充值
  const handleBuy = async () => {
    const val = parseInt(num, 10)
    if (!val || val <= 0 || !Number.isInteger(val)) {
      showText('请输入大于0的整数充值金额')
      return
    }

    if (payingRef.current) return
    payingRef.current = true

    try {
      showLoading('正在创建订单...')
      const paymentParams = await buyRecharge(val)
      await Taro.requestPayment(paymentParams)
      showSuccess('充值成功！')
      await authStore.refreshAvailable()
    } catch (e) {
      hideToast()
      const msg = e?.errMsg || e?.message || '支付取消'
      if (typeof msg === 'string' && msg.includes('cancel')) {
        return
      }
      showError(e.message || '支付失败')
    } finally {
      payingRef.current = false
    }
  }

  // 购买优惠活动
  const handleBuyEvent = async (id) => {
    if (payingRef.current) return
    payingRef.current = true

    try {
      showLoading('正在获取特惠...')
      const paymentParams = await buyEvent(id)
      await Taro.requestPayment(paymentParams)
      showSuccess('购买成功！')
      await authStore.refreshAvailable()
    } catch (e) {
      hideToast()
      const msg = e?.errMsg || e?.message || '支付取消'
      if (typeof msg === 'string' && msg.includes('cancel')) {
        return
      }
      showError(e.message || '支付失败')
    } finally {
      payingRef.current = false
    }
  }

  return (
    <View className='page-buy'>
      {/* 顶部当前余额 */}
      <View className='balance-banner'>
        <View className='balance-info'>
          <Text className='label'>当前账户余额</Text>
          <View className='value-wrap'>
            <Text className='sym'>¥</Text>
            <Text className='num'>{available.balance || '0.00'}</Text>
          </View>
        </View>
        {(available.arcade_days > 0 || available.days > 0) && (
          <View className='vip-tag'>
            <Text>音游畅玩剩余 {available.arcade_days ?? available.days} 天</Text>
          </View>
        )}
      </View>

      {/* 充值卡片 */}
      <View className='recharge-card'>
        <View className='card-title'>充值金额</View>

        {/* 快捷档位网格 */}
        <View className='amount-grid'>
          {PRESET_AMOUNTS.map((val) => (
            <View
              key={val}
              className={`amount-item btn-press-effect ${
                selectedPreset === val ? 'active' : ''
              }`}
              onClick={() => handleSelectPreset(val)}
            >
              <Text className='amount-num'>¥{val}</Text>
              <Text className='amount-label'>售价 {val}元</Text>
            </View>
          ))}
        </View>

        {/* 自定义输入框 */}
        <View className='custom-input-box'>
          <Text className='currency-symbol'>¥</Text>
          <Input
            type='number'
            className='amount-input'
            placeholder='输入整数充值金额'
            value={num}
            onInput={handleInputChange}
          />
        </View>

        {/* 微信支付按钮 */}
        <View className='pay-btn-big btn-press-effect' onClick={handleBuy}>
          <Text>微信支付 {num ? `¥${num}` : ''}</Text>
        </View>
      </View>

      {/* 优惠活动与机厅特惠 */}
      {events && events.length > 0 && (
        <View className='events-section'>
          <View className='section-title'>
            <Text className='icon'>🎁</Text>
            <Text>机厅特惠活动</Text>
          </View>

          <View className='event-cards-wrap'>
            {events.map((event) => (
              <View key={event.id} className='event-card-item'>
                <View className='event-info'>
                  <View className='event-name'>{event.name}</View>
                  <View className='event-tag'>限时特惠套餐</View>
                </View>
                <View
                  className='buy-action-btn btn-press-effect'
                  onClick={() => handleBuyEvent(event.id)}
                >
                  立即抢购
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 统一轻提示与加载 */}
      <AtToast {...toastProps} />
    </View>
  )
}
