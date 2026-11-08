import { useState, useCallback, useRef } from 'react'

/**
 * 统一基于 Taro-UI AtToast 的轻提示与加载 Hook
 */
export function useToast() {
  const [toastState, setToastState] = useState({
    isOpened: false,
    text: '',
    status: '',
    duration: 2000,
    hasMask: false,
    icon: '',
    image: '',
  })
  const timerRef = useRef(null)

  const hideToast = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setToastState((prev) => ({ ...prev, isOpened: false }))
  }, [])

  const showToast = useCallback(
    ({
      text = '',
      status = '',
      duration = 2000,
      hasMask = false,
      icon = '',
      image = '',
    }) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }

      setToastState({
        isOpened: true,
        text,
        status,
        duration,
        hasMask,
        icon,
        image,
      })

      if (duration > 0) {
        timerRef.current = setTimeout(() => {
          hideToast()
        }, duration)
      }
    },
    [hideToast]
  )

  const showLoading = useCallback(
    (text = '加载中...', hasMask = true) => {
      showToast({
        text,
        status: 'loading',
        duration: 0, // 持续显示，直到手动 hideToast
        hasMask,
      })
    },
    [showToast]
  )

  const showSuccess = useCallback(
    (text = '操作成功', duration = 2000) => {
      showToast({
        text,
        status: 'success',
        duration,
        hasMask: false,
      })
    },
    [showToast]
  )

  const showError = useCallback(
    (text = '操作失败', duration = 2500) => {
      showToast({
        text,
        status: 'error',
        duration,
        hasMask: false,
      })
    },
    [showToast]
  )

  const showText = useCallback(
    (text = '', duration = 2000) => {
      showToast({
        text,
        duration,
        hasMask: false,
      })
    },
    [showToast]
  )

  const toastProps = {
    ...toastState,
    onClose: hideToast,
  }

  return {
    toastProps,
    showToast,
    showLoading,
    showSuccess,
    showError,
    showText,
    hideToast,
  }
}

export default useToast
