import React, { useState, useEffect, useRef } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Button } from '@tarojs/components'
import './index.scss'

/**
 * 微信小程序隐私保护指引弹窗组件
 * 
 * 符合微信官方规范：
 * - wx.getPrivacySetting 查询授权状态与协议名
 * - wx.onNeedPrivacyAuthorization 监听隐私受限拦截
 * - wx.openPrivacyContract 打开官方指引页面
 * - wx.requirePrivacyAuthorize 校验/主动调起隐私授权
 * - 同意按钮必须为 openType="agreePrivacyAuthorization"
 */
export default function PrivacyPopup({ onAgree, onDisagree }) {
  const [visible, setVisible] = useState(false)
  const [contractName, setContractName] = useState('《小程序用户隐私保护指引》')
  const resolveRef = useRef(null)

  useEffect(() => {
    // 1. 获取隐私指引配置（仅用于展示正确的协议名称）
    if (typeof Taro.getPrivacySetting === 'function') {
      Taro.getPrivacySetting({
        success: (res) => {
          if (res.privacyContractName) {
            setContractName(res.privacyContractName)
          }
        },
      })
    }

    // 2. 注册隐私拦截监听（仅当受保护接口触发拦截时才显示）
    if (typeof Taro.onNeedPrivacyAuthorization === 'function') {
      Taro.onNeedPrivacyAuthorization((resolve, eventInfo) => {
        console.log('[PrivacyPopup] 隐私权限触发拦截:', eventInfo)
        resolveRef.current = resolve
        setVisible(true)
      })
    }

    return () => {
      // 卸载时如果有未处理的 resolve 则通知拒绝
      if (resolveRef.current) {
        try {
          resolveRef.current({ event: 'disagree' })
        } catch {
          // 忽略
        }
        resolveRef.current = null
      }
    }
  }, [])

  // 打开微信官方隐私协议页面
  const handleOpenContract = () => {
    if (typeof Taro.openPrivacyContract === 'function') {
      Taro.openPrivacyContract({
        fail: () => {
          Taro.showToast({
            title: '无法打开隐私协议',
            icon: 'none',
          })
        },
      })
    } else {
      Taro.showToast({
        title: '当前微信版本过低',
        icon: 'none',
      })
    }
  }

  // 用户点击同意
  const handleAgree = (e) => {
    console.log('[PrivacyPopup] 用户同意隐私授权:', e)
    setVisible(false)
    if (resolveRef.current) {
      resolveRef.current({ buttonId: 'agree-btn', event: 'agree' })
      resolveRef.current = null
    }
    if (onAgree) onAgree()
  }

  // 用户点击拒绝
  const handleDisagree = () => {
    setVisible(false)
    if (resolveRef.current) {
      resolveRef.current({ event: 'disagree' })
      resolveRef.current = null
    }
    Taro.showToast({
      title: '您已拒绝隐私授权，部分功能将受限',
      icon: 'none',
      duration: 2500,
    })
    if (onDisagree) onDisagree()
  }

  if (!visible) return null

  return (
    <View className='privacy-popup-overlay'>
      <View className='privacy-popup-card'>
        <View className='popup-header'>
          <Text className='popup-icon'>🔒</Text>
          <Text className='popup-title'>用户隐私保护指引</Text>
        </View>

        <View className='popup-body'>
          <Text className='body-text'>
            感谢使用衡水MUG。在使用快捷设置头像、玩家昵称智能填入等功能前，请仔细阅读并同意
          </Text>
          <Text className='contract-link' onClick={handleOpenContract}>
            {contractName}
          </Text>
          <Text className='body-text'>
            。当您点击“同意并继续”即表示您已阅读并同意全部条款。
          </Text>
        </View>

        <View className='popup-actions'>
          <Button
            className='btn-disagree'
            onClick={handleDisagree}
          >
            不同意
          </Button>
          <Button
            id='agree-btn'
            className='btn-agree'
            openType='agreePrivacyAuthorization'
            onAgreePrivacyAuthorization={handleAgree}
          >
            同意并继续
          </Button>
        </View>
      </View>
    </View>
  )
}
