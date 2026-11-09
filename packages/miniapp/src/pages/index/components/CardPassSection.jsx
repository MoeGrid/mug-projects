import React, { useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Button } from '@tarojs/components'
import { AtModal, AtModalHeader, AtModalContent, AtModalAction } from 'taro-ui'
import { rechargeTcgPass } from '@/api'
import { authStore } from '@/stores/auth'
import PassCard from './PassCard'

// 卡牌通行天数方案配置（充值天数，可自由累加）
export const PASS_PLANS = [
  {
    id: 'day',
    title: '充值 1 天',
    subTitle: '当天有效，至次日早 6:00 结算',
    price: 15,
    unit: '1天',
    days: 1,
    tag: '单日畅玩',
    featured: false,
    benefits: [
      '当天营业时间内无限次进出',
      '次日早 6:00 前有效，夜场无忧',
      '天数可叠加累计，多充多享',
      '免费借用高品质对战卡垫',
    ],
  },
  {
    id: 'monthly',
    title: '充值 30 天',
    subTitle: '包含当天整整30天，统一早 6:00 结算',
    price: 180,
    unit: '30天',
    days: 30,
    tag: '🔥 热门特惠',
    featured: true,
    benefits: [
      '包含当天整整 30 天全时段畅玩',
      '每天统一早 6:00 结算重置',
      '天数可自由累加顺延',
      '店内正品卡牌与周边享95折',
    ],
  },
]

export default function CardPassSection({
  available,
  onRechargeSuccess,
  showDialog,
  showLoading,
  showSuccess,
  showError,
}) {
  const [buyPassModalVisible, setBuyPassModalVisible] = useState(false)
  const [selectedPassPlan, setSelectedPassPlan] = useState(null)

  // 点击开通通行证
  const handleOpenBuyPass = (plan) => {
    setSelectedPassPlan(plan)
    setBuyPassModalVisible(true)
  }

  // 确认开通（调用后端真实充值天数接口）
  const handleConfirmBuyPass = async () => {
    if (!selectedPassPlan) return

    const currentBalance = Number(available.balance || 0)
    if (currentBalance < selectedPassPlan.price) {
      setBuyPassModalVisible(false)
      showDialog({
        title: '余额不足',
        content: `当前账户余额 ¥${currentBalance.toFixed(2)}，不足以购买【${selectedPassPlan.title}】（需 ¥${selectedPassPlan.price}）。是否前往充值？`,
        confirmText: '立即充值',
        cancelText: '取消',
        onConfirm: () => {
          Taro.navigateTo({ url: '/pages/index/buy' })
        },
      })
      return
    }

    try {
      showLoading('正在充值通行天数...')
      const res = await rechargeTcgPass(selectedPassPlan.id)
      await authStore.refreshAvailable()
      setBuyPassModalVisible(false)
      showSuccess(`充值成功！已累计增加 ${selectedPassPlan.days} 天畅玩`)
      if (onRechargeSuccess) {
        onRechargeSuccess(res)
      }
    } catch (e) {
      setBuyPassModalVisible(false)
      showError(e.message || '充值失败，请稍后重试')
    }
  }

  return (
    <View className='card-mode-section'>
      {/* A. 电子通行凭证卡 (直接复用 PassCard 组件，与 MUG 卡片完全一致) */}
      <PassCard
        title='MUG TCG PASS'
        watermark='TCG PASS'
        icon='🎴'
        days={available?.tcg_days || 0}
        mainDesc='TCG专区畅玩特权'
        subDesc='专座全天畅玩 · 无限次进出'
        inactiveDesc='暂未开通畅玩通行'
        inactiveSubDesc='按需充值天数 · 每天统一早 06:00 结算'
        showWhenZero={true}
      />

      {/* B. 通行证套餐办理专区 */}
      <View className='pass-plans-section'>
        <View className='section-header'>
          <Text className='section-title'>充值卡牌通行天数</Text>
          <Text className='section-subtitle'>到店畅玩 · 自由约战</Text>
        </View>

        <View className='plans-grid'>
          {PASS_PLANS.map((plan) => (
            <View
              key={plan.id}
              className={`plan-card btn-press-effect ${plan.featured ? 'plan-featured' : ''}`}
            >
              {plan.tag && <View className='plan-tag'>{plan.tag}</View>}
              <View className='plan-card-header'>
                <Text className='plan-name'>{plan.title}</Text>
                <Text className='plan-subtitle'>{plan.subTitle}</Text>
              </View>

              <View className='plan-price-wrap'>
                <Text className='currency'>¥</Text>
                <Text className='price-val'>{plan.price}</Text>
                <Text className='price-period'>/{plan.unit}</Text>
              </View>

              <View className='plan-benefits-list'>
                {plan.benefits.map((b, idx) => (
                  <View key={idx} className='benefit-item'>
                    <Text className='check'>✓</Text>
                    <Text className='benefit-desc'>{b}</Text>
                  </View>
                ))}
              </View>

              <View
                className={`plan-action-btn ${plan.featured ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => handleOpenBuyPass(plan)}
              >
                <Text>立即充值</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* C. 到店须知与专属特权 */}
      <View className='rules-card card-rules-card'>
        <View className='rules-title'>
          <Text className='icon'>📖</Text>
          <Text>卡牌专区到店须知</Text>
        </View>
        <View className='rule-item'>
          <Text className='rule-badge'>入场凭证</Text>
          <Text className='rule-text'>
            进店入场请主动向店员出示本有效通行证卡面，核验即可直接畅玩。
          </Text>
        </View>
        <View className='rule-item'>
          <Text className='rule-badge'>自由入座</Text>
          <Text className='rule-text'>
            通行证有效时间内，可在店内营业时间内自由进出，使用 TCG 专区空余卡位。
          </Text>
        </View>
        <View className='rule-item'>
          <Text className='rule-badge'>专属特权</Text>
          <Text className='rule-text'>
            通行证有效期间享特调饮品折扣与借用卡垫等额外福利，详情可在前台凭卡咨询。
          </Text>
        </View>
        <View className='rule-item'>
          <Text className='rule-badge'>文明对决</Text>
          <Text className='rule-text'>
            请爱护公用卡垫与桌椅环境，对决完毕后请带走随身垃圾，共同维护决斗氛围。
          </Text>
        </View>
      </View>

      {/* 通行证开通确认弹窗 */}
      <AtModal
        isOpened={buyPassModalVisible}
        closeOnClickOverlay={false}
        onClose={() => setBuyPassModalVisible(false)}
      >
        <AtModalHeader>充值卡牌通行天数</AtModalHeader>
        <AtModalContent>
          {selectedPassPlan && (
            <View className='buy-pass-modal-content'>
              <View className='modal-plan-header'>
                <Text className='plan-title-large'>{selectedPassPlan.title}</Text>
                <View className='price-highlight'>
                  <Text className='symbol'>¥</Text>
                  <Text className='amount'>{selectedPassPlan.price}</Text>
                  <Text className='unit'>/{selectedPassPlan.unit}</Text>
                </View>
              </View>

              <View className='modal-balance-row'>
                <Text className='label'>当前账户余额：</Text>
                <Text className='val'>¥{available.balance || '0.00'}</Text>
              </View>

              <View className='modal-privileges-box'>
                <Text className='box-title'>包含专属特权：</Text>
                {selectedPassPlan.benefits.map((b, i) => (
                  <View key={i} className='privilege-line'>
                    <Text className='check-icon'>✓</Text>
                    <Text className='privilege-text'>{b}</Text>
                  </View>
                ))}
              </View>

              <Text className='modal-tip-text'>
                * 确认充值将扣除相应账户余额，立即激活电子通行天数，进店出示即可畅玩。
              </Text>
            </View>
          )}
        </AtModalContent>
        <AtModalAction>
          <Button onClick={() => setBuyPassModalVisible(false)}>取消</Button>
          <Button onClick={handleConfirmBuyPass}>确认充值</Button>
        </AtModalAction>
      </AtModal>
    </View>
  )
}
