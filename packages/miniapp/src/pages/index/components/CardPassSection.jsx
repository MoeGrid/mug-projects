import React, { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { getTcgPassOptions, activateTcgPass, buyTcgMonthlyPass } from '@/api'
import { authStore } from '@/stores/auth'
import './CardPassSection.scss'

export default function CardPassSection({
  user,
  available,
  onRechargeSuccess,
  showDialog,
  showLoading,
  showSuccess,
  showError,
}) {
  const [pricing, setPricing] = useState({ day_price: 15, month_price: 180 })
  const [activating, setActivating] = useState(false)

  // 动态加载数据库 setting 中配置的最新价格
  const fetchPricing = async () => {
    try {
      const res = await getTcgPassOptions()
      if (res && res.day_price) {
        setPricing({
          day_price: Number(res.day_price),
          month_price: Number(res.month_price),
        })
      }
    } catch (e) {
      // 保持默认 fallback
    }
  }

  useEffect(() => {
    fetchPricing()
  }, [])

  const tcgDays = Number(available?.tcg_days || 0)
  const hasMonthlyPass = tcgDays > 1
  const isActiveToday = tcgDays > 0

  const currentBalance = Number(available?.balance || 0)
  const isBalanceEnoughForDay = currentBalance >= pricing.day_price

  // 1. 点击【开启今日畅玩】（单日开通，扣除当天费用，次日凌晨 6 点自动结束）
  const handleActivateToday = () => {
    if (isActiveToday) {
      if (hasMonthlyPass) {
        showSuccess('您持有有效月卡，进店特权生效中')
      } else {
        showSuccess('今日畅玩特权已生效中，次日早 06:00 自动到期')
      }
      return
    }

    if (!isBalanceEnoughForDay) {
      showDialog({
        title: '余额不足',
        content: `当前账户余额 ¥${currentBalance.toFixed(2)}，不足以开启今日畅玩（需 ¥${pricing.day_price}）。是否前往充值？`,
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
      content: `确认开启今日 TCG 畅玩？将从账户余额扣除 ¥${pricing.day_price}，有效至次日早 06:00 自动结束。`,
      confirmText: '立即开启',
      cancelText: '取消',
      onConfirm: async () => {
        try {
          setActivating(true)
          showLoading('正在开启...')
          const res = await activateTcgPass()
          await authStore.refreshAvailable()
          showSuccess(res.message || `开启成功！已扣除 ¥${pricing.day_price}`)
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
        content: `当前账户余额 ¥${currentBalance.toFixed(2)}，不足以办理月卡（需 ¥${pricing.month_price}）。是否前往充值？`,
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
      content: `确认办理 30 天 TCG 畅玩月卡？将从账户余额扣除 ¥${pricing.month_price}，开通后 30 天内每日进店均免扣费！当前可用余额 ¥${currentBalance.toFixed(2)}。`,
      confirmText: hasMonthlyPass ? '确认续费' : '确认开通',
      cancelText: '取消',
      onConfirm: async () => {
        try {
          showLoading('正在办理月卡...')
          const res = await buyTcgMonthlyPass()
          await authStore.refreshAvailable()
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
        <View className='monthly-vip-card'>
          <View className='vip-shimmer' />
          <View className='vip-watermark'>VIP PASS</View>
          <View className='vip-header'>
            <View className='vip-brand'>
              <Text className='vip-crown'>👑</Text>
              <View className='vip-brand-text'>
                <Text className='vip-brand-title'>TCG VIP PASS</Text>
                <Text className='vip-brand-sub'>畅玩月卡会员</Text>
              </View>
            </View>
            <View className='vip-status-badge'>
              <View className='pulse-gold-dot' />
              <Text>特权生效中</Text>
            </View>
          </View>

          <View className='vip-body'>
            <View className='vip-privilege-info'>
              <Text className='privilege-highlight'>整月每日进店免扣费</Text>
              <Text className='privilege-detail'>出示此页面即可直接进店</Text>
            </View>

            <View className='vip-days-box'>
              <Text className='days-val'>{tcgDays}</Text>
              <Text className='days-unit'>天剩余</Text>
            </View>
          </View>
        </View>
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
                <Text className='pricing-label'>临时单日畅玩</Text>
                <Text className='pricing-auto-rule'>次日早 06:00 自动到期 · 无需操作</Text>
              </View>
              <View className='pricing-right'>
                <Text className='currency'>¥</Text>
                <Text className='amount'>{pricing.day_price}</Text>
                <Text className='period'>/今日</Text>
              </View>
            </View>

            <View className='balance-indicator-row'>
              <Text className='balance-label'>当前账户可用余额：</Text>
              <Text
                className={`balance-val ${
                  isBalanceEnoughForDay ? 'sufficient' : 'insufficient'
                }`}
              >
                ¥{available?.balance || '0.00'}
                {!isBalanceEnoughForDay && ' (余额不足)'}
              </Text>
            </View>

            <View
              className={`start-play-main-btn btn-press-effect ${
                activating ? 'disabled' : ''
              }`}
              onClick={handleActivateToday}
            >
              <View className='btn-main-title'>
                <Text className='bolt-icon'>⚡</Text>
                <Text>开启今日畅玩</Text>
              </View>
              <Text className='btn-sub-tip'>
                扣除余额 ¥{pricing.day_price} · 开通后即可进店畅玩
              </Text>
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
        <View className='card-top-tag'>整月免扣费</View>
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
            {hasMonthlyPass
              ? `续费 30 天月卡 (¥${pricing.month_price})`
              : `开通 30 天畅玩月卡 (¥${pricing.month_price})`}
          </Text>
        </View>
      </View>
    </View>
  )
}
