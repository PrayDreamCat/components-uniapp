export const uploadFile = (filePath, extraData) => {
	return new Promise((resolve, reject) => {
		uni.uploadFile({
			url: uni.$u.http.config.baseURL + (extraData ? extraData.url : '/common/upload'),
			name: extraData?.name || 'file',
			filePath,
			header: {
				Authorization: `Bearer ${uni.getStorageSync('token')}`,
			},
			formData: extraData ? extraData.formData : {},
			success: (res) => {
				const data = JSON.parse(res.data)
				if (data.code == 200) {
					resolve(data)
				} else {
					reject(data)
				}
			},
			fail: res => {
				reject(res)
			}
		})
	})
}