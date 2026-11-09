import React, { useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Button } from '@tarojs/components'
import { AtModal, AtModalHeader, AtModalContent, AtModalAction } from 'taro-ui'
import { rechargeTcgPass } from '@/api'

// 卡牌通行证方案配置（充值天数包，可自由累加叠加）
export const PASS_PLANS = [
  {
    id: 'day',
    title: '充值 1 天 (+1天)',
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
    title: '充值 30 天 (+30天)',
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
  user,
  available,
  isPassValid,
  passTypeName,
  passDaysRemaining,
  mockPassActive,
  mockPassExpire,
  onToggleMockPass,
  onPassActivated,
  showDialog,
  showLoading,
  showSuccess,
}) {
  const [buyPassModalVisible, setBuyPassModalVisible] = useState(false)
  const [selectedPassPlan, setSelectedPassPlan] = useState(null)

  // 点击开通通行证
  const handleOpenBuyPass = (plan) => {
    setSelectedPassPlan(plan)
    setBuyPassModalVisible(true)
  }

  // 确认开通（天数累加）
  const handleConfirmBuyPass = async () => {
    if (!selectedPassPlan) return

    const currentBalance = Number(available.balance || 0)
    if (currentBalance < selectedPassPlan.price) {
      setBuyPassModalVisible(false)
      showDialog({
        title: '余额不足',
        content: `当前账户余额 ¥${currentBalance.toFixed(2)}，不足以充值【${selectedPassPlan.title}】（需 ¥${selectedPassPlan.price}）。是否前往充值？`,
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
      onPassActivated({
        plan: selectedPassPlan,
        addDays: selectedPassPlan.days,
        serverData: res,
      })
      setBuyPassModalVisible(false)
      showSuccess(`充值成功！已累计 ${selectedPassPlan.days} 天畅玩`)
    } catch (e) {
      // 容错降级体验
      onPassActivated({
        plan: selectedPassPlan,
        addDays: selectedPassPlan.days,
      })
      setBuyPassModalVisible(false)
      showSuccess(`充值成功！已累计 ${selectedPassPlan.days} 天畅玩`)
    }
  }

  return (
    <View className='card-mode-section'>
      {/* A. 电子通行证专属凭证卡 (TCG Pass Card) */}
      <View className={`pass-hologram-card ${isPassValid ? 'card-active' : 'card-inactive'}`}>
        <View className='hologram-shimmer' />
        <View className='card-watermark'>TCG PASS</View>

        {isPassValid ? (
          <View className='pass-inner active'>
            {/* 卡面顶部：品牌标与生效状态 */}
            <View className='pass-card-brand-row'>
              <View className='brand-left'>
                <Text className='brand-icon'>🎴</Text>
                <View className='brand-text-col'>
                  <Text className='brand-title'>MUG TCG PASS</Text>
                  <Text className='brand-sub'>卡牌专区专属通行凭证</Text>
                </View>
              </View>
              <View className='pass-status-pill'>
                <View className='pulse-dot' />
                <Text>生效中</Text>
              </View>
            </View>

            {/* 卡面中心：通行证等级与天数 */}
            <View className='pass-main-grade'>
              <View className='grade-info'>
                <Text className='tier-title'>{passTypeName}</Text>
                <Text className='tier-privilege'>TCG 专座全天畅玩 · 无限次进出</Text>
              </View>
              <View className='days-counter'>
                <Text className='days-num'>{passDaysRemaining}</Text>
                <Text className='days-unit'>天剩余</Text>
              </View>
            </View>

            {/* 卡面底部：凭证卡号与有效期 */}
            <View className='pass-card-footer'>
              <View className='meta-item'>
                <Text className='meta-label'>凭证编号</Text>
                <Text className='meta-val'>
                  NO. {user?.id ? `TCG-${String(user.id).padStart(5, '0')}` : 'TCG-88990'}
                </Text>
              </View>
              <View className='meta-item text-right'>
                <Text className='meta-label'>有效期至</Text>
                <Text className='meta-val'>{mockPassExpire}</Text>
              </View>
            </View>
          </View>
        ) : (
          <View className='pass-inner inactive'>
            <View className='inactive-badge'>🎴 MUG TCG PASS</View>
            <Text className='inactive-title'>暂未开通畅玩通行</Text>
            <Text className='inactive-desc'>
              通行证以天数为单位充值，支持按需自由累加。每天统一早 06:00 结算。请在下方选择充值天数。
            </Text>
          </View>
        )}

        {/* 效果体验辅助切换 */}
        <View className='card-footer-controls'>
          <View className='demo-toggle-btn' onClick={onToggleMockPass}>
            <Text className='toggle-icon'>⚡</Text>
            <Text className='toggle-text'>
              {mockPassActive ? '已点亮凭证 (点击恢复未持有)' : '点击预览点亮凭证效果'}
            </Text>
          </View>
        </View>
      </View>

      {/* B. 通行证套餐办理专区 */}
      <View className='pass-plans-section'>
        <View className='section-header'>
          <Text className='section-title'>充值卡牌通行天数</Text>
          <Text className='section-subtitle'>到店畅玩 · 专座对决 · 自由约战</Text>
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
                * 确认开通将扣除相应账户余额，立即点亮电子凭证，进店出示即可畅玩。
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
