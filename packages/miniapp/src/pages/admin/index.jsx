import React, { useState, useEffect, useRef, useCallback } from 'react'
import Taro, { useReachBottom, useDidShow } from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { AtSearchBar, AtAvatar, AtTag, AtLoadMore, AtToast } from 'taro-ui'

import { adminSearchUser, uploadUrl } from '@/api'
import { authStore } from '@/stores/auth'
import { useToast } from '@/hooks/useToast'

const defaultAvatar = '/static/avatar.jpg'

import './index.scss'

export default function AdminIndexPage() {
  const { toastProps, showError } = useToast()
  const [keyword, setKeyword] = useState('')
  const [users, setUsers] = useState([])
  const [pager, setPager] = useState({ page: 1, total: 1 })
  const [loading, setLoading] = useState(false)
  const canLoadRef = useRef(true)

  const getAvatar = (item) => {
    return item && item.avatar ? uploadUrl(item.avatar) : defaultAvatar
  }

  const searchData = useCallback(async (kw, page = 1, isClear = false) => {
    try {
      setLoading(true)
      const res = await adminSearchUser({
        keyword: kw,
        page,
        rows: 20,
      })

      if (isClear) {
        Taro.pageScrollTo({ scrollTop: 0 })
        setUsers(res.data || [])
      } else {
        setUsers((prev) => [...prev, ...(res.data || [])])
      }

      const totalPage = Math.max(Math.ceil((res.total || 0) / (res.per_page || 20)), 1)
      setPager({
        page: res.current_page || page,
        total: totalPage,
      })
    } catch (e) {
      showError(e.message || '查询失败')
    } finally {
      setLoading(false)
    }
  }, [showError])

  useEffect(() => {
    async function init() {
      await authStore.login()
      await searchData('', 1, true)
    }
    init()
  }, [searchData])

  // 上拉加载
  useReachBottom(async () => {
    if (!canLoadRef.current || pager.page >= pager.total || loading) return
    canLoadRef.current = false
    await searchData(keyword, pager.page + 1)
    canLoadRef.current = true
  })

  const handleSearch = () => {
    searchData(keyword, 1, true)
  }

  const handleClear = () => {
    setKeyword('')
    searchData('', 1, true)
  }

  const hasMore = pager.page < pager.total

  return (
    <View className='page-admin'>
      {/* 顶部固定搜索栏 */}
      <View className='search-bar-fixed'>
        <AtSearchBar
          value={keyword}
          placeholder='请输入 昵称/UID/备注'
          onChange={(val) => setKeyword(val)}
          onActionClick={handleSearch}
          onConfirm={handleSearch}
          onClear={handleClear}
        />
      </View>

      {/* 用户列表 */}
      <View className='admin-user-list'>
        {users.length > 0 ? (
          <View className='user-list-card'>
            {users.map((item) => (
              <View
                key={item.id}
                className='user-item-content'
                onClick={() =>
                  Taro.navigateTo({ url: `/pages/admin/user?id=${item.id}` })
                }
              >
                <View className='user-avatar-box'>
                  <AtAvatar size='small' image={getAvatar(item)} />
                </View>

                <View className='user-info-box'>
                  <View className='user-title-row'>
                    <Text className='nickname'>{item.nickname}</Text>
                    <View className='tag-item'>
                      <AtTag size='small' type='primary' circle>
                        {`UID: ${item.id}`}
                      </AtTag>
                    </View>
                    {Boolean(item.is_admin) && (
                      <View className='tag-item'>
                        <AtTag size='small' circle customStyle={{ backgroundColor: '#ff9900', color: '#fff' }}>
                          管理员
                        </AtTag>
                      </View>
                    )}
                    {Boolean(item.is_ban) && (
                      <View className='tag-item'>
                        <AtTag size='small' circle customStyle={{ backgroundColor: '#909399', color: '#fff' }}>
                          封禁
                        </AtTag>
                      </View>
                    )}
                  </View>
                  <View className='remark-text'>{item.remark || '-'}</View>
                </View>

                <Text className='arrow-right'>›</Text>
              </View>
            ))}
          </View>
        ) : (
          !loading && <View className='empty-wrap'>未找到匹配的用户</View>
        )}

        {users.length > 0 && (
          <AtLoadMore
            status={hasMore ? 'loading' : 'noMore'}
            moreText='点击加载更多'
            loadingText='正在加载中...'
            noMoreText='没有更多用户了'
          />
        )}
      </View>

      {/* 统一轻提示 */}
      <AtToast {...toastProps} />
    </View>
  )
}
