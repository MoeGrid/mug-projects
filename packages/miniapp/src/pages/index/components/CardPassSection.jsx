import React, { useState, useEffect, useCallback } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { getTcgPassOptions, tcgEntry, buyTcgPass } from '@/api'
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
    isEntryToday: false,
    hasTcgPass: false,
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
          isEntryToday: Boolean(res.is_entry_today),
          hasTcgPass: Boolean(res.has_tcg_pass),
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

  // 结合 store 中的数据（以接口返回的 status 为准）
  const tcgDays = status.hasTcgPass ? status.tcgDays : Number(available?.tcg_days || 0)
  const hasTcgPass = status.hasTcgPass || tcgDays > 0
  const isEntryToday = status.isEntryToday

  const currentBalance = Number(available?.balance || 0)
  const isBalanceEnoughForDay = currentBalance >= pricing.day_price

  // 1. 点击【进店入场】（单日入场，扣除入场费，次日凌晨 6 点自动到期；TCG PASS 用户免扣费）
  const handleEntryToday = () => {
    if (isEntryToday) {
      if (hasTcgPass) {
        showSuccess('您持有有效 TCG PASS，今日已完成入场')
      } else {
        showSuccess('今日已完成入场登记，有效至次日早 06:00')
      }
      return
    }

    // 若持有有效 TCG PASS，直接免费入场
    if (hasTcgPass) {
      showDialog({
        title: '进店入场',
        content: 'TCG PASS 特权生效中，本次免费入场，有效至次日早 06:00。确认入场？',
        confirmText: '立即入场',
        cancelText: '取消',
        onConfirm: async () => {
          try {
            setActivating(true)
            showLoading('正在登记入场...')
            const res = await tcgEntry()
            await authStore.refreshAvailable()
            await fetchStatus()
            showSuccess(res.message || '入场成功，欢迎进店！')
            if (onRechargeSuccess) {
              onRechargeSuccess(res)
            }
          } catch (e) {
            showError(e.message || '入场登记失败，请稍后重试')
          } finally {
            setActivating(false)
          }
        },
      })
      return
    }

    // 非 TCG PASS 用户：检查余额
    if (!isBalanceEnoughForDay) {
      showDialog({
        title: '余额不足',
        content: `余额不足以支付单日入场费（需 ¥${pricing.day_price}），是否前往充值？`,
        confirmText: '立即充值',
        cancelText: '取消',
        onConfirm: () => {
          Taro.navigateTo({ url: '/pages/index/buy' })
        },
      })
      return
    }

    showDialog({
      title: '进店入场',
      content: `确认进店入场？将扣除单日入场费 ¥${pricing.day_price}，有效至次日早 06:00 自动到期。`,
      confirmText: '立即入场',
      cancelText: '取消',
      onConfirm: async () => {
        try {
          setActivating(true)
          showLoading('正在登记入场...')
          const res = await tcgEntry()
          await authStore.refreshAvailable()
          await fetchStatus()
          showSuccess(res.message || '入场成功，欢迎进店！')
          if (onRechargeSuccess) {
            onRechargeSuccess(res)
          }
        } catch (e) {
          showError(e.message || '入场失败，请稍后重试')
        } finally {
          setActivating(false)
        }
      },
    })
  }

  // 2. 点击【办理 / 续费 TCG PASS】
  const handleOpenMonthlyModal = () => {
    if (currentBalance < pricing.month_price) {
      showDialog({
        title: '余额不足',
        content: `余额不足以开通 TCG PASS（需 ¥${pricing.month_price}），是否前往充值？`,
        confirmText: '立即充值',
        cancelText: '取消',
        onConfirm: () => {
          Taro.navigateTo({ url: '/pages/index/buy' })
        },
      })
      return
    }

    showDialog({
      title: hasTcgPass ? '续费 TCG PASS' : '开通 TCG PASS',
      content: `确认${hasTcgPass ? '续费' : '开通'} 30 天 TCG PASS？将扣除 ¥${pricing.month_price}，生效期内每日进店均免入场费。`,
      confirmText: hasTcgPass ? '确认续费' : '确认开通',
      cancelText: '取消',
      onConfirm: async () => {
        try {
          showLoading('正在办理 TCG PASS...')
          const res = await buyTcgPass()
          await authStore.refreshAvailable()
          await fetchStatus()
          showSuccess(res.message || 'TCG PASS 办理成功！')
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
      {/* 1. TCG PASS 大卡（仅持有 TCG PASS 用户展示） */}
      {hasTcgPass && (
        <PassCard
          title='TCG PASS'
          subTitle='通行证'
          watermark='TCG PASS'
          icon='👑'
          days={tcgDays}
          mainDesc='每日进店免入场费'
          subDesc='尽情畅玩'
        />
      )}

      {/* 2. 进店入场状态控制台 (未入场 vs 已入场) */}
      <View className={`today-console-card ${isEntryToday ? 'console-card-active' : ''}`}>
        <View className='console-header'>
          <View className='console-title-wrap'>
            <Text className='console-icon'>🎴</Text>
            <Text className='console-title'>TCG 入场</Text>
          </View>
          <View
            className={`console-status-pill ${
              isEntryToday ? 'status-active' : 'status-inactive'
            }`}
          >
            <View className='status-dot' />
            <Text>{isEntryToday ? '已入场' : '未入场'}</Text>
          </View>
        </View>

        {!isEntryToday ? (
          /* 未入场状态：展示价格、余额与入场按钮 */
          <View className='inactive-content'>
            <View className='pricing-highlight-box'>
              <View className='pricing-left'>
                <Text className='pricing-label'>
                  {hasTcgPass ? 'TCG PASS 特权' : '单日入场'}
                </Text>
                <Text className='pricing-auto-rule'>次日早 06:00 自动到期 · 无需额外操作</Text>
              </View>
              <View className='pricing-right'>
                {hasTcgPass ? (
                  <Text className='amount' style={{ fontSize: '20px', color: '#2ed573' }}>
                    免费入场
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
              onClick={handleEntryToday}
            >
              <View className='btn-main-title'>
                <Text className='bolt-icon'>⚡</Text>
                <Text>{hasTcgPass ? 'TCG PASS 免费入场' : '确认进店入场'}</Text>
              </View>
            </View>
          </View>
        ) : (
          /* 已入场状态：准入凭证 */
          <View className='active-content'>
            <View className='active-banner'>
              <Text className='banner-title'>✨ 今日已完成入场</Text>
              <View className='expire-badge'>
                <Text>有效至明日 06:00</Text>
              </View>
            </View>

            <View className='active-auto-footer'>
              <Text className='clock-icon'>⏰</Text>
              <Text className='auto-desc'>
                统一于次日早 06:00 自动到期，当天无需重复登记
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* 3. 开通 / 续费 TCG PASS */}
      <View className='monthly-upgrade-card'>
        <View className='card-top-tag'>30天免入场费</View>
        <View className='upgrade-header-row'>
          <View className='upgrade-title-wrap'>
            <Text className='upgrade-main-title'>TCG PASS (30天)</Text>
            <Text className='upgrade-sub-title'>
              {hasTcgPass
                ? `当前 TCG PASS 剩余 ${tcgDays} 天，可随时顺延续费`
                : '开通后 30 天内每日进店均免入场费'}
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
            {hasTcgPass ? '续费 30 天 TCG PASS' : '立即开通 TCG PASS'}
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
          <Text className='rule-badge'>离场须知</Text>
          <Text className='rule-text'>
            本店为无人值守空间，离开时若店内无其他人，请关闭所有机器、灯光、空调，并锁好大门。
          </Text>
        </View>
        <View className='rule-item'>
          <Text className='rule-badge'>自动截止</Text>
          <Text className='rule-text'>
            入场状态统一于次日早 06:00 自动到期结束，当天无需重复登记。
          </Text>
        </View>
        <View className='rule-item'>
          <Text className='rule-badge'>环境维护</Text>
          <Text className='rule-text'>
            请爱护公共桌椅设施与对战环境，离场前请带走个人随身物品与垃圾，保持整洁。
          </Text>
        </View>
      </View>
    </View>
  )
}
