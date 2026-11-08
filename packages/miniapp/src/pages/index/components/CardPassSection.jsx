import React, { useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Button } from '@tarojs/components'
import { AtModal, AtModalHeader, AtModalContent, AtModalAction } from 'taro-ui'

// 卡牌通行证方案配置
export const PASS_PLANS = [
  {
    id: 'day',
    title: '天卡',
    subTitle: '适合单日约战与体验畅玩',
    price: 15,
    unit: '天',
    tag: '单日门票',
    featured: false,
    benefits: [
      '营业时间内无限次进出',
      'TCG专区空位自由入座',
      '免费借用高品质对战卡垫',
    ],
  },
  {
    id: 'monthly',
    title: '尊享决斗月卡',
    subTitle: '常客高频对局首选，折合每天仅 ¥6',
    price: 180,
    unit: '30天',
    tag: '🔥 热门推荐',
    featured: true,
    benefits: [
      '30天全时段畅玩无限次进出',
      'VIP常驻对战卡位优先预约',
      '每月赠送精选特饮券 × 2',
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

  // 确认开通
  const handleConfirmBuyPass = () => {
    if (!selectedPassPlan) return

    const currentBalance = Number(available.balance || 0)
    if (currentBalance < selectedPassPlan.price) {
      setBuyPassModalVisible(false)
      showDialog({
        title: '余额不足',
        content: `当前账户余额 ¥${currentBalance.toFixed(2)}，不足以开通【${selectedPassPlan.title}】（需 ¥${selectedPassPlan.price}）。是否前往充值？`,
        confirmText: '立即充值',
        cancelText: '取消',
        onConfirm: () => {
          Taro.navigateTo({ url: '/pages/index/buy' })
        },
      })
      return
    }

    showLoading('正在开通通行证...')
    setTimeout(() => {
      const now = new Date()
      if (selectedPassPlan.id === 'day') {
        now.setDate(now.getDate() + 1)
      } else {
        now.setDate(now.getDate() + 30)
      }
      const newExpire = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

      onPassActivated({
        plan: selectedPassPlan,
        newExpire,
      })

      setBuyPassModalVisible(false)
      showSuccess(`恭喜！${selectedPassPlan.title}开通成功`)
    }, 600)
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
            <Text className='inactive-title'>暂未持有有效通行证</Text>
            <Text className='inactive-desc'>
              开通全日天卡或尊享月卡后，即可进店畅享专座对局与无限次出入特权。
            </Text>
            <View
              className='inactive-buy-btn btn-press-effect'
              onClick={() => handleOpenBuyPass(PASS_PLANS[1])}
            >
              <Text>立即办理月卡 (推荐)</Text>
            </View>
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
          <Text className='section-title'>办理卡牌通行证 / 门票</Text>
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
                <Text>立即开通</Text>
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
            尊享月卡包含特调饮品与借用卡垫等额外福利，详情可在前台凭卡领取。
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
        <AtModalHeader>开通卡牌通行证</AtModalHeader>
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
          <Button onClick={handleConfirmBuyPass}>确认开通</Button>
        </AtModalAction>
      </AtModal>
    </View>
  )
}
