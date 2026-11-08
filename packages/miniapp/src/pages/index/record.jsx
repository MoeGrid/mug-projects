import React, { useState, useEffect, useRef, useCallback } from 'react'
import Taro, { usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { AtLoadMore, AtToast } from 'taro-ui'

import { balanceLogList } from '@/api'
import { authStore } from '@/stores/auth'
import { useToast } from '@/hooks/useToast'

import './record.scss'

export default function RecordPage() {
  const { toastProps, showError } = useToast()
  const [records, setRecords] = useState([])
  const [pager, setPager] = useState({ page: 1, total: 1 })
  const [loading, setLoading] = useState(false)
  const canLoadRef = useRef(true)

  const getRecordTitle = (type) => {
    const titles = ['未知变动', '投币消费', '畅玩时长', '余额充值', '管理员调配', 'PASELI兑换']
    return titles[type] || '其他变动'
  }

  const getRecordIconAndClass = (type) => {
    switch (type) {
      case 1:
        return { icon: '🎮', cls: 'type-coin' }
      case 2:
        return { icon: '⏳', cls: 'type-day' }
      case 3:
        return { icon: '💳', cls: 'type-recharge' }
      case 4:
        return { icon: '⚙️', cls: 'type-admin' }
      default:
        return { icon: '🪙', cls: 'type-default' }
    }
  }

  const getRecordNumText = (num) => {
    return num <= 0 ? `${num}` : `+${num}`
  }

  const getRecordNumClass = (num) => {
    if (num > 0) return 'positive'
    if (num < 0) return 'negative'
    return 'neutral'
  }

  const loadData = useCallback(async (page = 1, isClear = false) => {
    try {
      setLoading(true)
      const res = await balanceLogList({
        page,
        rows: 20,
      })

      if (isClear) {
        Taro.pageScrollTo({ scrollTop: 0 })
        setRecords(res.data || [])
      } else {
        setRecords((prev) => [...prev, ...(res.data || [])])
      }

      const totalPage = Math.max(Math.ceil((res.total || 0) / (res.per_page || 20)), 1)
      setPager({
        page: res.current_page || page,
        total: totalPage,
      })
    } catch (e) {
      showError(e.message || '加载记录失败')
    } finally {
      setLoading(false)
    }
  }, [showError])

  useEffect(() => {
    async function init() {
      await authStore.login()
      await loadData(1, true)
    }
    init()
  }, [loadData])

  usePullDownRefresh(async () => {
    await loadData(1, true)
    Taro.stopPullDownRefresh()
  })

  useReachBottom(async () => {
    if (!canLoadRef.current || pager.page >= pager.total || loading) return
    canLoadRef.current = false
    await loadData(pager.page + 1)
    canLoadRef.current = true
  })

  const hasMore = pager.page < pager.total

  return (
    <View className='page-record'>
      {records.length > 0 ? (
        <View className='record-cards-list'>
          {records.map((item) => {
            const { icon, cls } = getRecordIconAndClass(item.type)
            return (
              <View key={item.id} className='record-card-item'>
                <View className='left-col'>
                  <View className={`type-icon-box ${cls}`}>{icon}</View>
                  <View className='text-details'>
                    <View className='record-title-row'>
                      <Text className='record-title'>{getRecordTitle(item.type)}</Text>
                    </View>
                    {(item.type === 1 || item.type === 2) && item.device && (
                      <View className='machine-info'>
                        {`${item.device.device_group?.name || ''} / ${item.device.name || ''}`}
                      </View>
                    )}
                    <View className='record-time'>{item.create_time}</View>
                  </View>
                </View>

                <View className='right-col'>
                  <Text className={`num-change ${getRecordNumClass(item.num)}`}>
                    {getRecordNumText(item.num)}
                  </Text>
                  <Text className='balance-remain'>结余 ¥{item.balance}</Text>
                </View>
              </View>
            )
          })}
        </View>
      ) : (
        !loading && (
          <View className='empty-state'>
            <Text className='empty-icon'>🕹️</Text>
            <Text className='empty-text'>暂无投币或充值流水记录</Text>
          </View>
        )
      )}

      {records.length > 0 && (
        <View style={{ marginTop: '20px' }}>
          <AtLoadMore
            status={hasMore ? 'loading' : 'noMore'}
            moreText='加载更多流水'
            loadingText='正在同步流水...'
            noMoreText='已显示全部流水明细'
          />
        </View>
      )}

      {/* 统一轻提示 */}
      <AtToast {...toastProps} />
    </View>
  )
}
