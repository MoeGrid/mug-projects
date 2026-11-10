import React, { useState, useEffect, useRef, useCallback } from 'react'
import Taro, { useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { AtSearchBar, AtAvatar, AtTag, AtLoadMore, AtToast, AtTabs } from 'taro-ui'

import {
  adminGetFinanceSummary,
  adminGetRecharges,
  adminGetConsumptions,
  adminGetTcgActiveSessions,
  adminSearchUsers,
  uploadUrl,
} from '@/api'
import { authStore } from '@/stores/auth'
import { useToast } from '@/hooks/useToast'

import './index.scss'

const defaultAvatar = '/static/avatar.jpg'

export default function AdminIndexPage() {
  const { toastProps, showError, showSuccess } = useToast()

  // 0: 监控抽查 (TCG在场), 1: 财务看板, 2: 用户管理
  const [mainTab, setMainTab] = useState(0)

  // ================= 1. 监控抽查 (TCG 在场) =================
  const [activeSessions, setActiveSessions] = useState([])
  const [loadingActive, setLoadingActive] = useState(false)

  const loadActiveSessions = useCallback(async () => {
    try {
      setLoadingActive(true)
      const data = await adminGetTcgActiveSessions()
      setActiveSessions(data || [])
    } catch (e) {
      showError(e.message || '获取在场名单失败')
    } finally {
      setLoadingActive(false)
    }
  }, [showError])

  // ================= 2. 财务看板 =================
  const [financeSummary, setFinanceSummary] = useState({
    today_recharge: '0.00',
    month_recharge: '0.00',
    today_consume: '0.00',
    month_consume: '0.00',
    active_tcg_count: 0,
  })
  // 财务子 Tab: 0 充值明细, 1 消费明细
  const [financeTab, setFinanceTab] = useState(0)

  // 充值分页
  const [recharges, setRecharges] = useState([])
  const [rechargePager, setRechargePager] = useState({ page: 1, total: 1 })
  const [loadingRecharges, setLoadingRecharges] = useState(false)

  // 消费分页
  const [consumptions, setConsumptions] = useState([])
  const [consumptionPager, setConsumptionPager] = useState({ page: 1, total: 1 })
  const [loadingConsumptions, setLoadingConsumptions] = useState(false)

  const loadFinanceSummary = useCallback(async () => {
    try {
      const summary = await adminGetFinanceSummary()
      if (summary) {
        setFinanceSummary(summary)
      }
    } catch (e) {
      // 财务统计读取静默捕获或提示
    }
  }, [])

  const loadRechargesData = useCallback(async (page = 1, isRefresh = false) => {
    try {
      setLoadingRecharges(true)
      const res = await adminGetRecharges({ page, rows: 20 })
      if (isRefresh) {
        setRecharges(res.data || [])
      } else {
        setRecharges((prev) => [...prev, ...(res.data || [])])
      }
      setRechargePager({
        page: res.current_page || page,
        total: res.last_page || 1,
      })
    } catch (e) {
      showError(e.message || '获取充值列表失败')
    } finally {
      setLoadingRecharges(false)
    }
  }, [showError])

  const loadConsumptionsData = useCallback(async (page = 1, isRefresh = false) => {
    try {
      setLoadingConsumptions(true)
      const res = await adminGetConsumptions({ page, rows: 20 })
      if (isRefresh) {
        setConsumptions(res.data || [])
      } else {
        setConsumptions((prev) => [...prev, ...(res.data || [])])
      }
      setConsumptionPager({
        page: res.current_page || page,
        total: res.last_page || 1,
      })
    } catch (e) {
      showError(e.message || '获取消费列表失败')
    } finally {
      setLoadingConsumptions(false)
    }
  }, [showError])

  // ================= 3. 用户管理 =================
  const [keyword, setKeyword] = useState('')
  const [users, setUsers] = useState([])
  const [userPager, setUserPager] = useState({ page: 1, total: 1 })
  const [loadingUsers, setLoadingUsers] = useState(false)

  const searchUsersData = useCallback(async (kw, page = 1, isClear = false) => {
    try {
      setLoadingUsers(true)
      const res = await adminSearchUsers({
        keyword: kw,
        page,
        rows: 20,
      })
      if (isClear) {
        setUsers(res.data || [])
      } else {
        setUsers((prev) => [...prev, ...(res.data || [])])
      }
      setUserPager({
        page: res.current_page || page,
        total: res.last_page || 1,
      })
    } catch (e) {
      showError(e.message || '查询用户失败')
    } finally {
      setLoadingUsers(false)
    }
  }, [showError])

  // ================= 初始化与刷新 =================
  useEffect(() => {
    async function init() {
      await authStore.login()
      if (!authStore.userInfo?.is_admin) {
        Taro.showModal({
          title: '访问受限',
          content: '当前账号暂无管理权限',
          showCancel: false,
          success: () => {
            Taro.reLaunch({ url: '/pages/index/index' })
          },
        })
        return
      }
      loadActiveSessions()
    }
    init()
  }, [loadActiveSessions])

  const handleTabChange = (idx) => {
    setMainTab(idx)
    if (idx === 0) {
      loadActiveSessions()
    } else if (idx === 1) {
      loadFinanceSummary()
      if (financeTab === 0 && recharges.length === 0) {
        loadRechargesData(1, true)
      } else if (financeTab === 1 && consumptions.length === 0) {
        loadConsumptionsData(1, true)
      }
    } else if (idx === 2) {
      if (users.length === 0) {
        searchUsersData(keyword, 1, true)
      }
    }
  }

  const handleFinanceSubTabChange = (idx) => {
    setFinanceTab(idx)
    if (idx === 0 && recharges.length === 0) {
      loadRechargesData(1, true)
    } else if (idx === 1 && consumptions.length === 0) {
      loadConsumptionsData(1, true)
    }
  }

  // 下拉全量刷新
  usePullDownRefresh(async () => {
    if (mainTab === 0) {
      await loadActiveSessions()
    } else if (mainTab === 1) {
      await Promise.all([
        loadFinanceSummary(),
        financeTab === 0 ? loadRechargesData(1, true) : loadConsumptionsData(1, true),
      ])
    } else if (mainTab === 2) {
      await searchUsersData(keyword, 1, true)
    }
    Taro.stopPullDownRefresh()
  })

  // 上拉触底加载更多
  const reachBottomLock = useRef(false)
  useReachBottom(async () => {
    if (reachBottomLock.current) return
    reachBottomLock.current = true

    if (mainTab === 1) {
      if (financeTab === 0) {
        if (rechargePager.page < rechargePager.total && !loadingRecharges) {
          await loadRechargesData(rechargePager.page + 1, false)
        }
      } else {
        if (consumptionPager.page < consumptionPager.total && !loadingConsumptions) {
          await loadConsumptionsData(consumptionPager.page + 1, false)
        }
      }
    } else if (mainTab === 2) {
      if (userPager.page < userPager.total && !loadingUsers) {
        await searchUsersData(keyword, userPager.page + 1, false)
      }
    }

    reachBottomLock.current = false
  })

  const getAvatar = (avatar) => {
    return avatar ? uploadUrl(avatar) : defaultAvatar
  }

  const navToUser = (id) => {
    if (!id) return
    Taro.navigateTo({ url: `/pages/admin/user?id=${id}` })
  }

  return (
    <View className='page-admin'>
      {/* 顶部主导航 Tab */}
      <View className='admin-header-tabs'>
        <AtTabs
          current={mainTab}
          tabList={[
            { title: '🔍 监控抽查' },
            { title: '📊 财务看板' },
            { title: '👥 用户管理' },
          ]}
          onClick={handleTabChange}
          swipeable={false}
        />
      </View>

      <View className='admin-body'>
        {/* ================= 1. 监控抽查 (TCG 在场) ================= */}
        {mainTab === 0 && (
          <View className='tab-panel inspection-panel'>
            <View className='panel-banner'>
              <View className='banner-info'>
                <Text className='banner-title'>无人值守·TCG开台抽查</Text>
                <Text className='banner-desc'>
                  核对监控画面坐席玩家是否均在当前开台列表中
                </Text>
              </View>
              <View className='banner-badge'>
                <Text className='count-num'>{activeSessions.length}</Text>
                <Text className='count-label'>人开台在场</Text>
              </View>
            </View>

            <View className='action-bar-row'>
              <Text className='section-title'>当前在场名单</Text>
              <View className='refresh-btn' onClick={loadActiveSessions}>
                <Text className='btn-text'>{loadingActive ? '刷新中...' : '🔄 刷新名单'}</Text>
              </View>
            </View>

            {activeSessions.length > 0 ? (
              <View className='active-session-list'>
                {activeSessions.map((item) => (
                  <View
                    key={item.session_id}
                    className='session-card'
                    onClick={() => navToUser(item.user_id)}
                  >
                    <View className='card-header'>
                      <View className='user-row'>
                        <AtAvatar size='small' image={getAvatar(item.avatar)} circle />
                        <View className='user-meta'>
                          <View className='nickname-row'>
                            <Text className='nickname'>{item.nickname}</Text>
                            <AtTag size='small' type='primary' circle>
                              {`UID: ${item.user_id}`}
                            </AtTag>
                          </View>
                          {item.phone && <Text className='phone'>{item.phone}</Text>}
                        </View>
                      </View>
                      <View className='pass-status'>
                        {item.is_monthly ? (
                          <View className='badge-monthly'>
                            <Text className='badge-text'>🌟 月卡畅玩</Text>
                          </View>
                        ) : (
                          <View className='badge-daily'>
                            <Text className='badge-text'>🎫 单日畅玩</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    <View className='card-body'>
                      <View className='info-item'>
                        <Text className='info-label'>开台打卡：</Text>
                        <Text className='info-value'>{item.create_time}</Text>
                      </View>
                      <View className='info-item'>
                        <Text className='info-label'>有效截止：</Text>
                        <Text className='info-value highlight'>{item.expire_time}</Text>
                      </View>
                      {item.has_monthly_pass && (
                        <View className='info-item'>
                          <Text className='info-label'>月卡剩余：</Text>
                          <Text className='info-value'>{item.tcg_days} 天</Text>
                        </View>
                      )}
                    </View>

                    <View className='card-footer'>
                      <Text className='link-tip'>点击查看/调配用户资产 ›</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              !loadingActive && (
                <View className='empty-card'>
                  <Text className='empty-icon'>🪑</Text>
                  <Text className='empty-title'>当前暂无玩家开台打卡</Text>
                  <Text className='empty-subtitle'>
                    店内若有正在使用卡牌桌椅的玩家，请核对是否未开启畅玩
                  </Text>
                </View>
              )
            )}
          </View>
        )}

        {/* ================= 2. 财务看板 ================= */}
        {mainTab === 1 && (
          <View className='tab-panel finance-panel'>
            {/* 核心指标四宫格 */}
            <View className='stat-grid'>
              <View className='stat-card recharge-today'>
                <Text className='stat-label'>今日累计充值</Text>
                <Text className='stat-val'>¥{financeSummary.today_recharge}</Text>
                <Text className='stat-tag'>微信支付流水</Text>
              </View>
              <View className='stat-card recharge-month'>
                <Text className='stat-label'>当月累计充值</Text>
                <Text className='stat-val'>¥{financeSummary.month_recharge}</Text>
                <Text className='stat-tag'>微信支付流水</Text>
              </View>
              <View className='stat-card consume-today'>
                <Text className='stat-label'>今日累计消费</Text>
                <Text className='stat-val'>¥{financeSummary.today_consume}</Text>
                <Text className='stat-tag'>投币/天卡/月卡</Text>
              </View>
              <View className='stat-card consume-month'>
                <Text className='stat-label'>当月累计消费</Text>
                <Text className='stat-val'>¥{financeSummary.month_consume}</Text>
                <Text className='stat-tag'>投币/天卡/月卡</Text>
              </View>
            </View>

            {/* 财务明细切换 */}
            <View className='finance-sub-tabs'>
              <View
                className={`sub-tab-item ${financeTab === 0 ? 'active' : ''}`}
                onClick={() => handleFinanceSubTabChange(0)}
              >
                <Text className='tab-text'>💰 充值入账记录</Text>
              </View>
              <View
                className={`sub-tab-item ${financeTab === 1 ? 'active' : ''}`}
                onClick={() => handleFinanceSubTabChange(1)}
              >
                <Text className='tab-text'>📉 消费流水明细</Text>
              </View>
            </View>

            {/* 充值明细列表 */}
            {financeTab === 0 && (
              <View className='finance-list-wrap'>
                {recharges.length > 0 ? (
                  <View className='finance-list'>
                    {recharges.map((item) => (
                      <View
                        key={item.id}
                        className='finance-item'
                        onClick={() => navToUser(item.user_id)}
                      >
                        <AtAvatar size='small' image={getAvatar(item.avatar)} circle />
                        <View className='item-meta'>
                          <View className='meta-row'>
                            <Text className='meta-name'>{item.nickname || '微信用户'}</Text>
                            <Text className='meta-uid'>UID:{item.user_id}</Text>
                          </View>
                          <View className='meta-sub-row'>
                            <Text className='meta-time'>{item.pay_time || '-'}</Text>
                          </View>
                          {item.we_order_id && (
                            <View className='meta-sub-row'>
                              <Text className='meta-sn'>单号: {item.we_order_id}</Text>
                            </View>
                          )}
                        </View>
                        <View className='item-amount recharge'>
                          <Text className='amount-text'>+¥{item.amount}</Text>
                          <Text className='amount-sub'>实到账 ¥{item.num}</Text>
                        </View>
                      </View>
                    ))}
                    <AtLoadMore
                      status={rechargePager.page < rechargePager.total ? 'loading' : 'noMore'}
                      loadingText='加载中...'
                      noMoreText='没有更多充值记录了'
                    />
                  </View>
                ) : (
                  !loadingRecharges && (
                    <View className='empty-card'>
                      <Text className='empty-title'>暂无充值记录</Text>
                    </View>
                  )
                )}
              </View>
            )}

            {/* 消费明细列表 */}
            {financeTab === 1 && (
              <View className='finance-list-wrap'>
                {consumptions.length > 0 ? (
                  <View className='finance-list'>
                    {consumptions.map((item) => (
                      <View
                        key={item.id}
                        className='finance-item'
                        onClick={() => navToUser(item.user_id)}
                      >
                        <AtAvatar size='small' image={getAvatar(item.avatar)} circle />
                        <View className='item-meta'>
                          <View className='meta-row'>
                            <Text className='meta-name'>{item.nickname || '微信用户'}</Text>
                            <Text className='meta-uid'>UID:{item.user_id}</Text>
                          </View>
                          <View className='meta-sub-row'>
                            <Text className='meta-remark'>{item.remark || '余额扣除'}</Text>
                          </View>
                          <View className='meta-sub-row'>
                            <Text className='meta-time'>{item.create_time || '-'}</Text>
                          </View>
                        </View>
                        <View className='item-amount consume'>
                          <Text className='amount-text'>-¥{item.cost}</Text>
                          <Text className='amount-sub'>余 ¥{item.balance_after}</Text>
                        </View>
                      </View>
                    ))}
                    <AtLoadMore
                      status={consumptionPager.page < consumptionPager.total ? 'loading' : 'noMore'}
                      loadingText='加载中...'
                      noMoreText='没有更多消费记录了'
                    />
                  </View>
                ) : (
                  !loadingConsumptions && (
                    <View className='empty-card'>
                      <Text className='empty-title'>暂无消费记录</Text>
                    </View>
                  )
                )}
              </View>
            )}
          </View>
        )}

        {/* ================= 3. 用户管理 ================= */}
        {mainTab === 2 && (
          <View className='tab-panel user-panel'>
            {/* 搜索栏 */}
            <View className='user-search-wrap'>
              <AtSearchBar
                value={keyword}
                placeholder='搜索 昵称 / UID / 手机号 / 备注'
                onChange={(val) => setKeyword(val)}
                onActionClick={() => searchUsersData(keyword, 1, true)}
                onConfirm={() => searchUsersData(keyword, 1, true)}
                onClear={() => {
                  setKeyword('')
                  searchUsersData('', 1, true)
                }}
              />
            </View>

            {/* 用户列表 */}
            <View className='user-list-card'>
              {users.length > 0 ? (
                <View className='user-list'>
                  {users.map((item) => (
                    <View
                      key={item.id}
                      className='user-item-row'
                      onClick={() => navToUser(item.id)}
                    >
                      <View className='user-avatar-box'>
                        <AtAvatar size='small' image={getAvatar(item.avatar)} circle />
                      </View>

                      <View className='user-info-box'>
                        <View className='user-title-row'>
                          <Text className='nickname'>{item.nickname || '玩家'}</Text>
                          <AtTag size='small' type='primary' circle>
                            {`UID: ${item.id}`}
                          </AtTag>
                          {Boolean(item.is_admin) && (
                            <AtTag
                              size='small'
                              circle
                              customStyle={{ backgroundColor: '#ff9900', color: '#fff', marginLeft: '4px' }}
                            >
                              管理员
                            </AtTag>
                          )}
                          {Boolean(item.is_ban) && (
                            <AtTag
                              size='small'
                              circle
                              customStyle={{ backgroundColor: '#909399', color: '#fff', marginLeft: '4px' }}
                            >
                              封禁
                            </AtTag>
                          )}
                        </View>

                        {/* 资产简述 */}
                        <View className='asset-badges-row'>
                          <Text className='asset-tag'>余额 ¥{item.balance || 0}</Text>
                          <Text className='asset-tag'>MUG {item.arcade_days ?? 0}天</Text>
                          <Text className='asset-tag'>TCG {item.tcg_days ?? 0}天</Text>
                        </View>

                        {item.remark && (
                          <View className='remark-text'>备注: {item.remark}</View>
                        )}
                      </View>

                      <Text className='arrow-right'>›</Text>
                    </View>
                  ))}
                  <AtLoadMore
                    status={userPager.page < userPager.total ? 'loading' : 'noMore'}
                    loadingText='正在加载中...'
                    noMoreText='没有更多用户了'
                  />
                </View>
              ) : (
                !loadingUsers && (
                  <View className='empty-card'>
                    <Text className='empty-title'>未找到匹配的用户</Text>
                  </View>
                )
              )}
            </View>
          </View>
        )}
      </View>

      {/* 统一提示 */}
      <AtToast {...toastProps} />
    </View>
  )
}
