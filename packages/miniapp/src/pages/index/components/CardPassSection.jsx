import React, { useState, useEffect, useCallback } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { getTcgPassOptions, activateTcgPass, buyTcgMonthlyPass } from '@/api'
import { authStore } from '@/stores/auth'
import PassCard from './PassCard'
import './CardPassSection.scss'

export default function CardPassSection({
  user,
  available,
  pricing: propPricing,
  status: propStatus,
  onRefresh,
  onRechargeSuccess,
  showDialog,
  showLoading,
  showSuccess,
  showError,
}) {
  const [localPricing, setLocalPricing] = useState({ day_price: 15, month_price: 180 })
  const [localStatus, setLocalStatus] = useState({
    isActiveToday: false,
    hasMonthlyPass: false,
    tcgDays: 0,
  })
  const [activating, setActivating] = useState(false)

  // 独立使用时的兜底加载逻辑
  const fetchStatus = useCallback(async () => {
    if (onRefresh) {
      return onRefresh()
    }
    try {
      const res = await getTcgPassOptions()
      if (res) {
        if (res.day_price) {
          setLocalPricing({
            day_price: Number(res.day_price),
            month_price: Number(res.month_price),
          })
        }
        setLocalStatus({
          isActiveToday: Boolean(res.is_active_today),
          hasMonthlyPass: Boolean(res.has_monthly_pass),
          tcgDays: Number(res.tcg_days || 0),
        })
      }
    } catch (e) {
      // 保持当前状态
    }
  }, [onRefresh])

  useEffect(() => {
    if (!propStatus) {
      fetchStatus()
    }
  }, [fetchStatus, propStatus])

  // 优先取 props（父级统一数据源），兜底取 local
  const pricing = propPricing || localPricing
  const status = propStatus || localStatus

  // 兜底结合 store 中的数据（以接口返回的 status 为准）
  const tcgDays = status.hasMonthlyPass ? status.tcgDays : Number(available?.tcg_days || 0)
  const hasMonthlyPass = status.hasMonthlyPass || tcgDays > 0
  const isActiveToday = status.isActiveToday

  const currentBalance = Number(available?.balance || 0)
  const isBalanceEnoughForDay = currentBalance >= pricing.day_price

  // 1. 点击【开启今日畅玩】（单日开通，扣除当天费用，次日凌晨 6 点自动结束；月卡用户免扣费）
  const handleActivateToday = () => {
    if (isActiveToday) {
      if (hasMonthlyPass) {
        showSuccess('您持有有效月卡，今日畅玩已生效中')
      } else {
        showSuccess('今日畅玩特权已生效中，次日早 06:00 自动到期')
      }
      return
    }

    // 若持有有效月卡，直接开启
    if (hasMonthlyPass) {
      showDialog({
        title: '开启今日畅玩',
        content: '月卡特权生效中，本次免费，有效至次日早 06:00 自动结束。确认开启？',
        confirmText: '立即开启',
        cancelText: '取消',
        onConfirm: async () => {
          try {
            setActivating(true)
            showLoading('正在开启...')
            const res = await activateTcgPass()
            await authStore.refreshAvailable()
            await fetchStatus()
            showSuccess(res.message || '今日畅玩已开启')
            if (onRechargeSuccess) {
              onRechargeSuccess(res)
            }
          } catch (e) {
            showError(e.message || '开启失败，请稍后重试')
          } finally {
            setActivating(false)
          }
        },
      })
      return
    }

    // 非月卡用户：检查余额
    if (!isBalanceEnoughForDay) {
      showDialog({
        title: '余额不足',
        content: `余额不足以开启今日畅玩（需 ¥${pricing.day_price}），是否前往充值？`,
        confirmText: '立即充值',
        cancelText: '取消',
        onConfirm: () => {
          Taro.navigateTo({ url: '/pages/index/buy' })
        },
      })
      return
    }

    showDialog({
      title: '开启今日畅玩',
      content: `确认开启今日畅玩？将扣除 ¥${pricing.day_price}，有效至次日早 06:00 自动结束。`,
      confirmText: '立即开启',
      cancelText: '取消',
      onConfirm: async () => {
        try {
          setActivating(true)
          showLoading('正在开启...')
          const res = await activateTcgPass()
          await authStore.refreshAvailable()
          await fetchStatus()
          showSuccess(res.message || '开启成功')
          if (onRechargeSuccess) {
            onRechargeSuccess(res)
          }
        } catch (e) {
          showError(e.message || '开启失败，请稍后重试')
        } finally {
          setActivating(false)
        }
      },
    })
  }

  // 2. 点击【开通 / 续费月卡】
  const handleOpenMonthlyModal = () => {
    if (currentBalance < pricing.month_price) {
      showDialog({
        title: '余额不足',
        content: `余额不足以办理月卡（需 ¥${pricing.month_price}），是否前往充值？`,
        confirmText: '立即充值',
        cancelText: '取消',
        onConfirm: () => {
          Taro.navigateTo({ url: '/pages/index/buy' })
        },
      })
      return
    }

    showDialog({
      title: hasMonthlyPass ? '续费 TCG 畅玩月卡' : '开通 TCG 畅玩月卡',
      content: `确认${hasMonthlyPass ? '续费' : '办理'} 30 天月卡？将扣除 ¥${pricing.month_price}，生效期内每日进店免扣费。`,
      confirmText: hasMonthlyPass ? '确认续费' : '确认开通',
      cancelText: '取消',
      onConfirm: async () => {
        try {
          showLoading('正在办理月卡...')
          const res = await buyTcgMonthlyPass()
          await authStore.refreshAvailable()
          await fetchStatus()
          showSuccess(res.message || '月卡办理成功！')
          if (onRechargeSuccess) {
            onRechargeSuccess(res)
          }
        } catch (e) {
          showError(e.message || '办理失败，请稍后重试')
        }
      },
    })
  }

  return (
    <View className='tcg-mode-container'>
      {/* 1. 尊享月卡会员大卡（仅月卡用户展示） */}
      {hasMonthlyPass && (
        <PassCard
          title='TCG VIP PASS'
          subTitle='畅玩月卡会员'
          watermark='VIP PASS'
          icon='👑'
          days={tcgDays}
          mainDesc='每日进店免扣费'
          subDesc='出示此页面即可直接进店'
        />
      )}

      {/* 2. 今日畅玩状态控制台 (未开启 vs 已开启) */}
      <View className={`today-console-card ${isActiveToday ? 'console-card-active' : ''}`}>
        <View className='console-header'>
          <View className='console-title-wrap'>
            <Text className='console-icon'>🎴</Text>
            <Text className='console-title'>今日畅玩</Text>
          </View>
          <View
            className={`console-status-pill ${
              isActiveToday ? 'status-active' : 'status-inactive'
            }`}
          >
            <View className='status-dot' />
            <Text>{isActiveToday ? '已开通 · 畅玩中' : '未开通'}</Text>
          </View>
        </View>

        {!isActiveToday ? (
          /* 未开通状态：展示价格、余额与开启按钮 */
          <View className='inactive-content'>
            <View className='pricing-highlight-box'>
              <View className='pricing-left'>
                <Text className='pricing-label'>
                  {hasMonthlyPass ? '月卡畅玩' : '单日畅玩'}
                </Text>
                <Text className='pricing-auto-rule'>次日早 06:00 自动到期 · 无需操作</Text>
              </View>
              <View className='pricing-right'>
                {hasMonthlyPass ? (
                  <Text className='amount' style={{ fontSize: '20px', color: '#2ed573' }}>
                    免费
                  </Text>
                ) : (
                  <>
                    <Text className='currency'>¥</Text>
                    <Text className='amount'>{pricing.day_price}</Text>
                    <Text className='period'>/今日</Text>
                  </>
                )}
              </View>
            </View>

            <View
              className={`start-play-main-btn btn-press-effect ${
                activating ? 'disabled' : ''
              }`}
              onClick={handleActivateToday}
            >
              <View className='btn-main-title'>
                <Text className='bolt-icon'>⚡</Text>
                <Text>{hasMonthlyPass ? '开启今日畅玩 (免扣费)' : '开启今日畅玩'}</Text>
              </View>
            </View>
          </View>
        ) : (
          /* 已开通状态：准入凭证 */
          <View className='active-content'>
            <View className='active-banner'>
              <View className='banner-left'>
                <Text className='banner-title'>
                  {hasMonthlyPass ? '👑 月卡生效中 · 进店免扣费' : '✨ 今日已开通 · 进店畅玩'}
                </Text>
                <Text className='banner-sub'>出示本页面即可直接进店畅玩</Text>
              </View>
              <View className='expire-badge'>
                <Text>有效至明日 06:00</Text>
              </View>
            </View>

            <View className='active-auto-footer'>
              <Text className='clock-icon'>⏰</Text>
              <Text className='auto-desc'>
                统一于次日早 06:00 自动结束，当天无需重复操作
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* 3. 开通 / 续费 TCG 畅玩月卡 */}
      <View className='monthly-upgrade-card'>
        <View className='card-top-tag'>30天免扣费</View>
        <View className='upgrade-header-row'>
          <View className='upgrade-title-wrap'>
            <Text className='upgrade-main-title'>TCG 畅玩月卡 (30天)</Text>
            <Text className='upgrade-sub-title'>
              {hasMonthlyPass
                ? `当前月卡剩余 ${tcgDays} 天，可随时顺延续费`
                : '开通后 30 天内每日进店均免扣费'}
            </Text>
          </View>
          <View className='upgrade-price-wrap'>
            <Text className='currency'>¥</Text>
            <Text className='price-val'>{pricing.month_price}</Text>
            <Text className='period'>/30天</Text>
          </View>
        </View>

        <View
          className='upgrade-action-btn btn-press-effect'
          onClick={handleOpenMonthlyModal}
        >
          <Text>
            {hasMonthlyPass ? '续费 30 天月卡' : '立即开通月卡'}
          </Text>
        </View>
      </View>
    </View>
  )
}
