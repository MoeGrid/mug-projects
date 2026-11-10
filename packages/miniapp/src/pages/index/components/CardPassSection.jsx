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

  // 生成今日核销防伪串
  const getTodayCode = () => {
    const d = new Date()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${month}${day}`
  }

  // 1. 点击【开启今日专座畅玩】（临时单日开台，每日点一次扣 n 余额，次日凌晨 6 点自动结束）
  const handleActivateToday = () => {
    if (isActiveToday) {
      if (hasMonthlyPass) {
        showSuccess('您持有有效月卡，畅玩特权已生效中')
      } else {
        showSuccess('今日畅玩特权已在生效中，次日早 06:00 自动到期')
      }
      return
    }

    if (!isBalanceEnoughForDay) {
      showDialog({
        title: '余额不足',
        content: `当前账户余额 ¥${currentBalance.toFixed(2)}，不足以开启今日专座畅玩（需 ¥${pricing.day_price}）。是否前往充值？`,
        confirmText: '立即充值',
        cancelText: '取消',
        onConfirm: () => {
          Taro.navigateTo({ url: '/pages/index/buy' })
        },
      })
      return
    }

    showDialog({
      title: '开启今日专座畅玩',
      content: `确认开启今日 TCG 专座畅玩？将从您的账户余额扣除 ¥${pricing.day_price}，有效至次日早 06:00 自动结算。`,
      confirmText: '立即开启',
      cancelText: '取消',
      onConfirm: async () => {
        try {
          setActivating(true)
          showLoading('正在开台激活...')
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
      content: `确认办理 30 天 TCG 畅玩月卡？将从账户余额扣除 ¥${pricing.month_price}，未来整整 30 天每日畅玩免扣费！当前可用余额 ¥${currentBalance.toFixed(2)}。`,
      confirmText: hasMonthlyPass ? '确认续费' : '确认开通',
      cancelText: '取消',
      onConfirm: async () => {
        try {
          showLoading('正在办理月卡...')
          const res = await buyTcgMonthlyPass()
          await authStore.refreshAvailable()
          showSuccess(res.message || '月卡办理成功！未来 30 天每日畅玩免扣费')
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
                <Text className='vip-brand-sub'>尊享畅玩月卡会员</Text>
              </View>
            </View>
            <View className='vip-status-badge'>
              <View className='pulse-gold-dot' />
              <Text>特权生效中</Text>
            </View>
          </View>

          <View className='vip-body'>
            <View className='vip-privilege-info'>
              <Text className='privilege-highlight'>整月每日任意畅玩</Text>
              <Text className='privilege-detail'>免扣余额 · 专座对决 · 自由进出</Text>
            </View>

            <View className='vip-days-box'>
              <Text className='days-val'>{tcgDays}</Text>
              <Text className='days-unit'>天剩余</Text>
            </View>
          </View>
        </View>
      )}

      {/* 2. 今日对战专座控制台 (临时开台 vs 畅玩中凭证) */}
      <View className={`today-console-card ${isActiveToday ? 'console-card-active' : ''}`}>
        <View className='console-header'>
          <View className='console-title-wrap'>
            <Text className='console-icon'>🎴</Text>
            <Text className='console-title'>今日专座畅玩</Text>
          </View>
          <View
            className={`console-status-pill ${
              isActiveToday ? 'status-active' : 'status-inactive'
            }`}
          >
            <View className='status-dot' />
            <Text>{isActiveToday ? '正在畅玩中' : '未开台'}</Text>
          </View>
        </View>

        {!isActiveToday ? (
          /* 未开台状态：展示单日计费与一键开台按钮 */
          <View className='inactive-content'>
            <View className='pricing-highlight-box'>
              <View className='pricing-left'>
                <Text className='pricing-label'>临时单日畅玩</Text>
                <Text className='pricing-auto-rule'>次日 06:00 自动结束 · 无需手动操作</Text>
              </View>
              <View className='pricing-right'>
                <Text className='currency'>¥</Text>
                <Text className='amount'>{pricing.day_price}</Text>
                <Text className='period'>/今日</Text>
              </View>
            </View>

            <View className='perks-list'>
              <View className='perk-item'>
                <Text className='perk-check'>✓</Text>
                <Text>专座全天畅玩</Text>
              </View>
              <View className='perk-item'>
                <Text className='perk-check'>✓</Text>
                <Text>营业时间内无限次进出</Text>
              </View>
              <View className='perk-item'>
                <Text className='perk-check'>✓</Text>
                <Text>免费借用高品质卡垫</Text>
              </View>
              <View className='perk-item'>
                <Text className='perk-check'>✓</Text>
                <Text>当日无需重复计费</Text>
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
                <Text>开启今日专座畅玩</Text>
              </View>
              <Text className='btn-sub-tip'>
                扣除余额 ¥{pricing.day_price} · 统一至次日早 06:00 自动结束
              </Text>
            </View>
          </View>
        ) : (
          /* 畅玩中状态：展示核销凭证与倒计时提醒 */
          <View className='active-content'>
            <View className='active-banner'>
              <View className='banner-left'>
                <Text className='banner-title'>
                  {hasMonthlyPass ? '👑 尊享月卡特权已开台' : '✨ 今日专座畅玩已激活'}
                </Text>
                <Text className='banner-sub'>
                  {hasMonthlyPass
                    ? '月度会员本日免扣费，到店出示即可畅玩'
                    : '今日营业时间内自由进出，已成功开台'}
                </Text>
              </View>
              <View className='expire-badge'>
                <Text>有效至明日 06:00</Text>
              </View>
            </View>

            <View className='pass-credential-box'>
              <View className='credential-col'>
                <Text className='cred-label'>到店核销凭证码</Text>
                <Text className='cred-val'>
                  TCG-{user?.id ? String(user.id).padStart(4, '0') : '0001'}-{getTodayCode()}
                </Text>
              </View>
              <Text className='cred-tip'>进店出示直接畅玩</Text>
            </View>

            <View className='active-auto-footer'>
              <Text className='clock-icon'>⏰</Text>
              <Text className='auto-desc'>
                统一于次日早 06:00 自动结束，期间自由对决，无需任何手动操作
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* 3. 开通 / 续费 TCG 畅玩月卡专区 (长期通票) */}
      <View className='monthly-upgrade-card'>
        <View className='card-top-tag'>🔥 整月免扣费</View>
        <View className='upgrade-header-row'>
          <View className='upgrade-title-wrap'>
            <Text className='upgrade-main-title'>TCG 畅玩月卡 (30天)</Text>
            <Text className='upgrade-sub-title'>
              {hasMonthlyPass
                ? `当前月卡剩余 ${tcgDays} 天，可随时顺延续费`
                : '经常来店？开通月卡，整月每日免扣费随心畅玩'}
            </Text>
          </View>
          <View className='upgrade-price-wrap'>
            <Text className='currency'>¥</Text>
            <Text className='price-val'>{pricing.month_price}</Text>
            <Text className='period'>/30天</Text>
          </View>
        </View>

        <View className='upgrade-perks-row'>
          <View className='perk-pill'>
            <Text className='check-gold'>✓</Text>
            <Text className='pill-text'>整月每日畅玩免扣费</Text>
          </View>
          <View className='perk-pill'>
            <Text className='check-gold'>✓</Text>
            <Text className='pill-text'>免去每日单独开台扣费</Text>
          </View>
          <View className='perk-pill'>
            <Text className='check-gold'>✓</Text>
            <Text className='pill-text'>支持随时顺延叠加天数</Text>
          </View>
          <View className='perk-pill'>
            <Text className='check-gold'>✓</Text>
            <Text className='pill-text'>免费借用专业对战卡垫</Text>
          </View>
        </View>

        <View
          className='upgrade-action-btn btn-press-effect'
          onClick={handleOpenMonthlyModal}
        >
          <Text>
            {hasMonthlyPass
              ? `续费 30 天月卡 (¥${pricing.month_price})`
              : `立即开通畅玩月卡 (¥${pricing.month_price})`}
          </Text>
        </View>
      </View>

      {/* 4. 卡牌专区到店须知 */}
      <View className='rules-card'>
        <View className='rules-title'>
          <Text className='icon'>📖</Text>
          <Text>卡牌专区到店须知</Text>
        </View>
        <View className='rule-item'>
          <Text className='rule-badge'>入场凭证</Text>
          <Text className='rule-text'>
            进店入场请主动向店员出示本页面「正在畅玩中」核销凭证，核验即可直接入座。
          </Text>
        </View>
        <View className='rule-item'>
          <Text className='rule-badge'>自动结束</Text>
          <Text className='rule-text'>
            每日畅玩统一于次日早 06:00 自动结束结算，期间自由进出，无需任何手动操作。
          </Text>
        </View>
        <View className='rule-item'>
          <Text className='rule-badge'>月卡权益</Text>
          <Text className='rule-text'>
            持有有效月卡期间，整月每天进店开台均免扣除任何余额，高频玩家更实惠。
          </Text>
        </View>
        <View className='rule-item'>
          <Text className='rule-badge'>文明对决</Text>
          <Text className='rule-text'>
            请爱护公用对战桌椅与卡垫环境，对决完毕后带走随身垃圾，共同维护决斗氛围。
          </Text>
        </View>
      </View>
    </View>
  )
}
