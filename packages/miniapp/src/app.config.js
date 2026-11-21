export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/index/login',
    'pages/index/profile',
    'pages/index/buy',
    'pages/index/record',
    'pages/admin/index',
    'pages/admin/user',
  ],
  networkTimeout: {
    request: 15000,
    uploadFile: 60000,
    downloadFile: 60000,
  },
  window: {
    backgroundTextStyle: 'dark',
    navigationBarBackgroundColor: '#F8F8F8',
    navigationBarTitleText: '衡水MUG',
    navigationBarTextStyle: 'black',
    backgroundColor: '#F8F8F8',
  },
})
