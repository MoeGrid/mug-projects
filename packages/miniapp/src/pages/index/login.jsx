import React, { useEffect, useRef, useState } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { View, Text, Button } from '@tarojs/components'

import { authorizeQr, QR_ACTION } from '@/api'
import { authStore } from '@/stores/auth'

import './login.scss'

/** 页面阶段 */
const PHASE = {
  READY: 'ready',
  INVALID: 'invalid',
  AUTHORIZING: 'authorizing',
  DONE: 'done',
  ERROR: 'error',
}

/** 不同扫码用途的文案。新增用途时在这里补一份即可，页面结构不变 */
const COPY = {
  [QR_ACTION.FACE_BIND]: {
    eyebrow: 'FACE ENROLL',
    hero: '绑定人脸',
    sub: '让这张脸直接刷开 MUG 的门',
    readyTitle: '授权登录，绑你的人脸',
    readyDesc:
      '你在门店一体机上刚采集的人脸还没绑定账号。点击下方授权，这张脸会直接写入你的微信账号，不需要在小程序里重新拍照。',
    doneTitle: '授权完成',
    doneDesc: (nick) =>
      `一体机正在把这帧人脸写入${nick ? ` ${nick} ` : '你的'}账号，结果以大屏显示为准，现在可以离开本页了。`,
    btn: '授权登录',
  },
  [QR_ACTION.LOGIN]: {
    eyebrow: 'QR LOGIN',
    hero: '扫码登录',
    sub: '微信扫一扫，直接登录发起设备',
    readyTitle: '确认登录这台设备',
    readyDesc:
      '发起设备正在请求登录你的 MUG 账号。确认后它会以你的身份继续操作；如果不是本人在操作，请直接关闭本页。',
    doneTitle: '登录成功',
    doneDesc: (nick) =>
      `${nick ? ` ${nick} ` : '你的账号'}已经登录到发起设备，可以回到那边继续操作。`,
    btn: '确认登录',
  },
}

const FALLBACK_COPY = COPY[QR_ACTION.FACE_BIND]

/**
 * 从页面参数里解析二维码信息。
 *
 * 二维码内容形如：https://v2.mug.moegrid.com/login?qr=xxx&a=face_bind&t=180
 * 用途（a）和有效期（t）都跟着 URL 一起来，页面不用先请求一次接口。
 *
 * 三种参数来源：
 * 1. 扫「普通链接二维码」：微信把完整链接放在 q 参数里（?q=https%3A%2F%2F...%3Fqr%3Dxxx）
 * 2. 小程序码：参数在 scene 里（scene=xxx 或 scene=qr%3Dxxx）
 * 3. 直接带 qr 参数（调试 / 分享链接）
 */
function pickQrParams(params = {}) {
  const decode = (raw) => {
    try {
      return decodeURIComponent(raw)
    } catch (e) {
      return raw
    }
  }

  // 候选来源统一成「可能带 query 的字符串」再解析
  let source = ''
  if (params.qr) {
    source = `qr=${params.qr}`
  } else if (params.q) {
    source = decode(params.q)
  } else if (params.scene) {
    source = decode(params.scene)
  }

  if (source) {
    const query = source.includes('?') ? source.slice(source.indexOf('?') + 1) : source
    const found = {}
    query.split('&').forEach((pair) => {
      const idx = pair.indexOf('=')
      if (idx <= 0) return
      const key = pair.slice(0, idx)
      if (key === 'qr' || key === 'a' || key === 't') {
        found[key] = decode(pair.slice(idx + 1))
      }
    })
    // scene 可能是纯 token
    if (!found.qr && /^[a-f0-9]{16,64}$/i.test(source)) found.qr = source
    if (found.qr) {
      return {
        token: found.qr,
        action: found.a || QR_ACTION.FACE_BIND,
        ttl: Math.max(0, parseInt(found.t, 10) || 0),
      }
    }
  }

  return { token: '', action: QR_ACTION.FACE_BIND, ttl: 0 }
}

function formatCountdown(seconds) {
  const safe = Math.max(0, seconds || 0)
  const m = String(Math.floor(safe / 60)).padStart(2, '0')
  const s = String(safe % 60).padStart(2, '0')
  return `${m}:${s}`
}

export default function QrAuthorizePage() {
  const router = useRouter()
  // 进页面时定一次：router.params 每次渲染都是新对象，不能直接当依赖
  const initial = useRef(pickQrParams(router.params || {}))
  const { token, action: initialAction, ttl } = initial.current

  const [phase, setPhase] = useState(token ? PHASE.READY : PHASE.INVALID)
  const [action, setAction] = useState(initialAction)
  const [remain, setRemain] = useState(ttl)
  const [nickname, setNickname] = useState('')
  const [message, setMessage] = useState(
    token ? '' : '没有识别到二维码参数，请在发起设备上重新扫码。'
  )

  const copy = COPY[action] || FALLBACK_COPY

  // 本地倒计时：二维码到期就提示。授权结果由服务端推给发起设备，页面不轮询
  useEffect(() => {
    if (phase !== PHASE.READY) return undefined
    if (!ttl) return undefined
    const timer = setInterval(() => {
      setRemain((prev) => {
        const next = prev - 1
        if (next <= 0) {
          setPhase(PHASE.INVALID)
          setMessage('这张二维码已经过期，请在发起设备上刷新后重新扫描。')
          return 0
        }
        return next
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [phase, ttl])

  // 授权：先静默登录拿账号，再把扫码会话绑定到该账号
  const handleAuthorize = async () => {
    if (!token) return
    setPhase(PHASE.AUTHORIZING)
    setMessage('')
    try {
      await authStore.login(true)
      const res = await authorizeQr(token)
      const nick = res.nickname || (authStore.user && authStore.user.nickname) || ''
      setNickname(nick)
      if (res.action) setAction(res.action)
      // 授权就是终点：令牌已经发给发起设备，这里直接显示完成
      setPhase(PHASE.DONE)
    } catch (e) {
      // 404 无效 / 410 过期 / 409 已被占用：都是这张码不能用了，不用再重试
      if (e.status === 404 || e.status === 410 || e.status === 409) {
        setPhase(PHASE.INVALID)
        setMessage(e.message)
        return
      }
      setPhase(PHASE.ERROR)
      setMessage(e.message || '授权失败，请重试')
    }
  }

  const handleDone = () => {
    const pages = Taro.getCurrentPages()
    if (pages.length > 1) {
      Taro.navigateBack()
    } else {
      Taro.reLaunch({ url: '/pages/index/index' })
    }
  }

  const expired = phase === PHASE.INVALID || phase === PHASE.ERROR

  return (
    <View className='page-face-login'>
      <View className='glow glow-top' />
      <View className='glow glow-bottom' />

      <View className='hero'>
        <Text className='hero-eyebrow'>{copy.eyebrow}</Text>
        <Text className='hero-title'>{copy.hero}</Text>
        <Text className='hero-sub'>{copy.sub}</Text>
      </View>

      <View className='card'>
        {/* 待授权 */}
        {(phase === PHASE.READY || phase === PHASE.AUTHORIZING) && (
          <View className='state-block'>
            <View className='badge'>待授权</View>
            <Text className='state-title'>{copy.readyTitle}</Text>
            <Text className='state-desc'>{copy.readyDesc}</Text>

            {ttl > 0 && (
              <View className='countdown'>
                <Text className='countdown-label'>二维码剩余</Text>
                <Text className='countdown-value'>{formatCountdown(remain)}</Text>
              </View>
            )}

            <Button
              className='primary-btn'
              hoverClass='primary-btn-hover'
              loading={phase === PHASE.AUTHORIZING}
              disabled={phase === PHASE.AUTHORIZING}
              onClick={handleAuthorize}
            >
              {phase === PHASE.AUTHORIZING ? '正在授权…' : copy.btn}
            </Button>

            <Text className='hint'>
              授权仅代表同意本次操作使用你的微信账号，不会获取你的其他信息。
            </Text>
          </View>
        )}

        {/* 完成 */}
        {phase === PHASE.DONE && (
          <View className='state-block'>
            <View className='success-icon'>✓</View>
            <Text className='state-title'>{copy.doneTitle}</Text>
            <Text className='state-desc'>{copy.doneDesc(nickname)}</Text>
            <Button className='primary-btn' hoverClass='primary-btn-hover' onClick={handleDone}>
              完成
            </Button>
          </View>
        )}

        {/* 失效 / 出错 */}
        {expired && (
          <View className='state-block'>
            <View className='error-icon'>!</View>
            <Text className='state-title'>
              {phase === PHASE.ERROR ? '授权失败' : '二维码已失效'}
            </Text>
            <Text className='state-desc'>
              {message || '请在发起设备上刷新二维码后重新扫描。'}
            </Text>
            {phase === PHASE.ERROR && (
              <Button className='ghost-btn' onClick={handleAuthorize}>
                重试
              </Button>
            )}
          </View>
        )}
      </View>

      <Text className='footer'>MUG · 衡水音游 & 卡牌空间</Text>
    </View>
  )
}
