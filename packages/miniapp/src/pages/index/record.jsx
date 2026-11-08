import React, { useState, useEffect, useRef, useCallback } from 'react'
import Taro, { usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { AtLoadMore, AtToast } from 'taro-ui'

import { getCoinLogs, getTransactionLogs } from '@/api'
import { authStore } from '@/stores/auth'
import { useToast } from '@/hooks/useToast'

import './record.scss'

export default function RecordPage() {
  const { toastProps, showError } = useToast()
  // 当前激活 Tab：0=街机投币记录, 1=钱包账单流水
  const [activeTab, setActiveTab] = useState(0)

  // 投币记录数据状态
  const [coinRecords, setCoinRecords] = useState([])
  const [coinPager, setCoinPager] = useState({ page: 1, total: 1 })

  // 资金流水数据状态
  const [transRecords, setTransRecords] = useState([])
  const [transPager, setTransPager] = useState({ page: 1, total: 1 })

  const [loading, setLoading] = useState(false)
  const canLoadRef = useRef(true)

  // 加载投币记录
  const loadCoinLogs = useCallback(
    async (page = 1, isClear = false) => {
      try {
        setLoading(true)
        const res = await getCoinLogs({ page, rows: 20 })
        if (isClear) {
          Taro.pageScrollTo({ scrollTop: 0 })
          setCoinRecords(res.data || [])
        } else {
          setCoinRecords((prev) => [...prev, ...(res.data || [])])
        }
        const totalPage = Math.max(Math.ceil((res.total || 0) / (res.per_page || 20)), 1)
        setCoinPager({
          page: res.current_page || page,
          total: totalPage,
        })
      } catch (e) {
        showError(e.message || '加载投币记录失败')
      } finally {
        setLoading(false)
      }
    },
    [showError]
  )

  // 加载资金账单
  const loadTransLogs = useCallback(
    async (page = 1, isClear = false) => {
      try {
        setLoading(true)
        const res = await getTransactionLogs({ page, rows: 20 })
        if (isClear) {
          Taro.pageScrollTo({ scrollTop: 0 })
          setTransRecords(res.data || [])
        } else {
          setTransRecords((prev) => [...prev, ...(res.data || [])])
        }
        const totalPage = Math.max(Math.ceil((res.total || 0) / (res.per_page || 20)), 1)
        setTransPager({
          page: res.current_page || page,
          total: totalPage,
        })
      } catch (e) {
        showError(e.message || '加载账单流水失败')
      } finally {
        setLoading(false)
      }
    },
    [showError]
  )

  // 切换 Tab
  const handleSwitchTab = (tabIdx) => {
    if (activeTab === tabIdx) return
    setActiveTab(tabIdx)
    if (tabIdx === 0 && coinRecords.length === 0) {
      loadCoinLogs(1, true)
    } else if (tabIdx === 1 && transRecords.length === 0) {
      loadTransLogs(1, true)
    }
  }

  useEffect(() => {
    async function init() {
      await authStore.login()
      await loadCoinLogs(1, true)
      await loadTransLogs(1, true)
    }
    init()
  }, [loadCoinLogs, loadTransLogs])

  // 下拉刷新
  usePullDownRefresh(async () => {
    if (activeTab === 0) {
      await loadCoinLogs(1, true)
    } else {
      await loadTransLogs(1, true)
    }
    Taro.stopPullDownRefresh()
  })

  // 上拉加载更多
  useReachBottom(async () => {
    if (!canLoadRef.current || loading) return
    if (activeTab === 0) {
      if (coinPager.page >= coinPager.total) return
      canLoadRef.current = false
      await loadCoinLogs(coinPager.page + 1)
      canLoadRef.current = true
    } else {
      if (transPager.page >= transPager.total) return
      canLoadRef.current = false
      await loadTransLogs(transPager.page + 1)
      canLoadRef.current = true
    }
  })

  // 资金流水图标与样式
  const getTransMeta = (bizType) => {
    switch (bizType) {
      case 1:
        return { icon: '🎮', cls: 'type-coin', defaultTitle: '街机投币消费' }
      case 2:
        return { icon: '💳', cls: 'type-recharge', defaultTitle: '微信支付充值' }
      case 3:
        return { icon: '🎴', cls: 'type-pass', defaultTitle: '卡牌通行证开通' }
      case 4:
        return { icon: '⚙️', cls: 'type-admin', defaultTitle: '系统手动调配' }
      case 5:
        return { icon: '🪙', cls: 'type-paseli', defaultTitle: 'PASELI 兑换' }
      default:
        return { icon: '📄', cls: 'type-default', defaultTitle: '账户资金变动' }
    }
  }

  const currentRecords = activeTab === 0 ? coinRecords : transRecords
  const currentPager = activeTab === 0 ? coinPager : transPager
  const hasMore = currentPager.page < currentPager.total

  return (
    <View className='page-record'>
      {/* 顶部胶囊切换栏 */}
      <View className='record-tabs-nav'>
        <View
          className={`tab-item ${activeTab === 0 ? 'active' : ''}`}
          onClick={() => handleSwitchTab(0)}
        >
          <Text className='tab-icon'>🕹️</Text>
          <Text className='tab-text'>街机投币记录</Text>
        </View>
        <View
          className={`tab-item ${activeTab === 1 ? 'active' : ''}`}
          onClick={() => handleSwitchTab(1)}
        >
          <Text className='tab-icon'>💳</Text>
          <Text className='tab-text'>钱包账单流水</Text>
        </View>
      </View>

      {/* Tab 0: 街机投币履约记录 */}
      {activeTab === 0 && (
        <View className='tab-pane-container'>
          {coinRecords.length > 0 ? (
            <View className='record-cards-list'>
              {coinRecords.map((item) => (
                <View key={item.id} className='record-card-item'>
                  <View className='left-col'>
                    <View
                      className={`type-icon-box ${
                        item.pay_type === 2 ? 'coin-free-icon' : 'coin-balance-icon'
                      }`}
                    >
                      {item.pay_type === 2 ? '⚡' : '🕹️'}
                    </View>
                    <View className='text-details'>
                      <View className='record-title-row'>
                        <Text className='record-title'>
                          {item.device
                            ? `${item.device.device_group?.name || ''} · ${item.device.name || ''}`
                            : '街机投币'}
                        </Text>
                      </View>
                      <View className='sub-info-row'>
                        <Text className='channel-tag'>
                          {item.channel === 1 ? '蓝牙直连' : '远程脉冲'}
                        </Text>
                        <Text className='record-time'>{item.create_time}</Text>
                      </View>
                    </View>
                  </View>

                  <View className='right-col'>
                    {item.pay_type === 2 ? (
                      <View className='badge-pill free-pill'>⚡ 畅玩免扣</View>
                    ) : (
                      <Text className='cost-num'>-¥{item.cost_amount}</Text>
                    )}
                    <Text className='coin-count-label'>
                      出币 {item.coin_num || 1} 币
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            !loading && (
              <View className='empty-state'>
                <Text className='empty-icon'>🕹️</Text>
                <Text className='empty-text'>暂无街机投币记录</Text>
              </View>
            )
          )}
        </View>
      )}

      {/* Tab 1: 钱包资金变动流水 */}
      {activeTab === 1 && (
        <View className='tab-pane-container'>
          {transRecords.length > 0 ? (
            <View className='record-cards-list'>
              {transRecords.map((item) => {
                const meta = getTransMeta(item.biz_type)
                const isPositive = Number(item.change_amount) > 0
                return (
                  <View key={item.id} className='record-card-item'>
                    <View className='left-col'>
                      <View className={`type-icon-box ${meta.cls}`}>{meta.icon}</View>
                      <View className='text-details'>
                        <View className='record-title-row'>
                          <Text className='record-title'>
                            {item.remark || meta.defaultTitle}
                          </Text>
                        </View>
                        <View className='record-time'>{item.create_time}</View>
                      </View>
                    </View>

                    <View className='right-col'>
                      <Text
                        className={`num-change ${isPositive ? 'positive' : 'negative'}`}
                      >
                        {isPositive
                          ? `+¥${item.change_amount}`
                          : `-¥${Math.abs(Number(item.change_amount)).toFixed(2)}`}
                      </Text>
                      <Text className='balance-remain'>
                        结余 ¥{item.balance_after || item.balance}
                      </Text>
                    </View>
                  </View>
                )
              })}
            </View>
          ) : (
            !loading && (
              <View className='empty-state'>
                <Text className='empty-icon'>💳</Text>
                <Text className='empty-text'>暂无钱包流水账单</Text>
              </View>
            )
          )}
        </View>
      )}

      {/* 加载更多提示 */}
      {currentRecords.length > 0 && (
        <View style={{ marginTop: '20px' }}>
          <AtLoadMore
            status={hasMore ? 'loading' : 'noMore'}
            moreText='加载更多记录'
            loadingText='正在同步记录...'
            noMoreText='已显示全部记录'
          />
        </View>
      )}

      {/* 轻提示 */}
      <AtToast {...toastProps} />
    </View>
  )
}
