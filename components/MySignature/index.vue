<template>
	<view class="box-my-signature" :style="{ height: fullHeight }" v-if="visible">
		<view class="content">
			<view class="title">
				<view>确认签字</view>
				<image src="./close.png" class="icon-close" @click="handleClose"></image>
			</view>
			<view class="tip" :style="{ paddingTop: paddingTop }">
				<view>请将手机屏幕置于横屏，从左至右书写全名</view>
			</view>
			<view class="box-signature">
				<view class="btns">
					<view class="btn-rotate btn-1" @click="handleClearCanvas">重签</view>
					<view class="btn-rotate box-name">
						<view class="box-name-label">请签</view>
						<view class="btn-1">{{name}}</view>
					</view>
					<view class="btn-rotate btn-2" @click="handleToImage">完成</view>
				</view>
				<view class="box-canvas" id="boxCanvas" ref="boxCanvas">
					<canvas ref="canvas" id="canvas" canvas-id="canvas" :disable-scroll="true"
						:style="{ width: canvasWidth + 'px', height: canvasHeight + 'px', zIndex: 999}"
						:class="{ 'canvas-hide': signatureSrc }" @touchstart="handleTouchStart" @touchmove="handleTouchMove"
						@touchend="handleTouchEnd" />
					<!-- 					<view :class="['box-tip', tipClass]"
						:style="{ width: canvasHeight + 'px', height: canvasWidth + 'px', transform: `rotate(90deg) translateY(${0-canvasWidth}px)` }">
						{{ name }}
					</view> -->
					<image :src="signatureSrc" mode="aspectFit" class="img-signature"
						:style="{width: canvasWidth + 'px', height: canvasHeight + 'px'}" v-if="signatureSrc" />
				</view>
				<canvas ref="canvasHide" id="canvas-hide" canvas-id="canvas-hide" :disable-scroll="true"
					:style="{ width: canvasWidth + 'px', height: canvasHeight + 'px', position: 'absolute', left: '100vw' }" />
			</view>
		</view>
		<u-toast ref="uToast" />
	</view>
</template>

<script>
	import {
		uploadFile
	} from '@/utils/util.js'
	import {
		pathToBase64
	} from 'image-tools'

	export default {
		props: {
			name: {
				type: String,
			},
			fullHeight: {
				type: String,
				default: 'calc(100vh)'
			},
			showBtnClose: {
				type: Boolean,
				default: false,
			},
			changeTopPos: {
				type: Boolean,
				default: false,
			},
			needUpload: {
				type: Boolean,
				default: true
			}
		},
		data() {
			return {
				canvasWidth: 400,
				canvasHeight: 100,
				ctx: null,
				ctxHide: null,
				signatureSrc: null,
				signatureSuccessInfo: null,
				isSigned: false,
				tipClass: '',
				srcForUpload: null,
				paddingTop: '',
				btnCloseTop: '',
				visible: false,
			}
		},
		mounted() {
			this.begin = false;
			this.startX = 0;
			this.startY = 0;
		},
		methods: {
			open() {
				this.visible = true
				this.$nextTick(() => {
					this.initCanvas()
				})
			},
			handleClose() {
				this.visible = false
			},
			initCanvas() {
				if (this.changeTopPos) {
					const res = wx.getMenuButtonBoundingClientRect();
					this.paddingTop = res.bottom + 'px';
					this.btnCloseTop = res.bottom - res.height / 2 + 'px';
				}
				uni.setNavigationBarColor({
					frontColor: '#000000',
					backgroundColor: '#ffffff'
				});
				// 直接使用document.getElementById无法获取DOM元素
				this.$nextTick(() => {
					const query = uni.createSelectorQuery().in(this)
					query.select('#boxCanvas').boundingClientRect()
					query.exec(data => {
						this.canvasWidth = data[0].width;
						this.canvasHeight = data[0].height;
					})
					this.ctx = uni.createCanvasContext('canvas', this)
					this.ctxHide = uni.createCanvasContext('canvas-hide', this)
				})
			},
			handleTouchStart(e) {
				if (this.signatureSrc) return
				this.ctx.strokeStyle = "#000000"; //设置线的颜色状态
				this.ctx.lineCap = 'round';
				this.ctx.lineJoin = 'round'
				this.ctx.lineWidth = 8
				this.lineBegin(e.changedTouches[0].x, e.changedTouches[0].y)
				this.isSigned = true
			},
			handleTouchMove(e) {
				if (this.signatureSrc) return
				if (this.begin) {
					this.lineAddPoint(e.changedTouches[0].x, e.changedTouches[0].y);
					this.ctx.draw(true);
				}
			},
			handleTouchEnd() {
				this.lineEnd();
			},
			lineEnd: function() {
				this.ctx.closePath();
				this.begin = false;
			},
			// 开始绘制线条
			lineBegin: function(x, y) {
				this.begin = true;
				this.ctx.beginPath()
				this.startX = x;
				this.startY = y;
				this.ctx.moveTo(this.startX, this.startY)
				this.lineAddPoint(x, y);
			},
			// 绘制线条中间添加点
			lineAddPoint: function(x, y) {
				this.ctx.moveTo(this.startX, this.startY)
				this.ctx.lineTo(x, y)
				this.ctx.stroke();
				this.startX = x;
				this.startY = y;
			},
			// 清空画布
			handleClearCanvas() {
				this.isSigned = false
				this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
				this.ctx.draw();
				this.signatureSrc = null
				this.signatureSuccessInfo = null
				this.srcForUpload = null
			},
			uploadSignSrc(src) {
				if (this.needUpload) {
					uploadFile(src)
						.then(res => {
							uni.hideLoading();
							this.signatureSuccessInfo = res;
							this.$emit('success', res);
						})
						.catch(res => {
							console.log('上传签字图片失败', res)
							uni.hideLoading()
							this.$refs.uToast.show({
								message: res.msg || '网络异常，请检查网络连接',
								type: 'error'
							})
						})
				} else {
					pathToBase64(src).then(res => {
						const index = res.indexOf(',')
						this.$emit('success', res.slice(index + 1));
					})
				}
			},
			// 生成签字图片
			handleToImage() {
				if (!this.isSigned) {
					return uni.showToast({
						title: '请签字',
						icon: 'none'
					})
				}
				if (this.signatureSuccessInfo) {
					this.$emit('success', this.signatureSuccessInfo)
					return
				}
				if (this.srcForUpload) {
					uni.showLoading({
						title: '上传签名中',
						mask: true
					})
					this.uploadSignSrc(this.srcForUpload)
					return
				}
				let tempSrc = null
				uni.showLoading({
					title: '正在生成签名',
					mask: true
				})
				uni.canvasToTempFilePath({
					canvasId: 'canvas',
					success: (res) => {
						console.log('生成图片成功', res)
						this.signatureSrc = res.tempFilePath
						tempSrc = res.tempFilePath
						this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
						this.ctx.draw();
						this.ctxHide.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
						this.ctxHide.draw();
						uni.getImageInfo({
							src: tempSrc,
							success: res => {
								console.log('获取签名图片信息成功', res)
								const imgWidth = 250 * res.width / res.height
								// this.ctxHide.setFillStyle('red')
								// this.ctxHide.fillRect(0, 0, 250, 250);
								this.ctxHide.rotate(270 * Math.PI / 180)
								this.ctxHide.transform(1, 0, 0, 1, -120, 0)
								this.ctxHide.drawImage(res.path, -imgWidth * 0.3, 250 * 0.2,
									imgWidth * 0.6, 250 * 0.6)
								this.ctxHide.draw()
								setTimeout(() => {
									uni.canvasToTempFilePath({
										canvasId: 'canvas-hide',
										width: 250,
										height: 250,
										success: res => {
											console.log('生成签字图片成功', res)
											this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
											this.ctx.draw()
											this.srcForUpload = res.tempFilePath
											this.uploadSignSrc(res.tempFilePath)
										},
										fail: res => {
											console.log('生成签字图片失败', res)
											uni.hideLoading()
											this.$refs.uToast.show({
												message: res.msg,
												type: 'error'
											})
										}
									}, this)
								}, 200)
							},
							fail: (res) => {
								console.log('获取签名图片信息失败', res)
								uni.hideLoading()
								this.$refs.uToast.show({
									message: res.msg,
									type: 'error'
								})
							}
						})
					},
					fail: (res) => {
						console.log('生成图片失败', res)
						uni.hideLoading()
						this.$refs.uToast.show({
							message: res.msg,
							type: 'error'
						})
					}
				}, this)
			},
		}
	}
</script>

<style lang="scss" scoped>
	.title {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 34rpx;
		letter-spacing: 2rpx;
		padding: 62rpx 0 40rpx 0;
		font-weight: 400;
		font-size: 36rpx;
		color: #333333;

		.icon-close {
			width: 32rpx;
			height: 32rpx;
			position: absolute;
			right: 60rpx;
		}
	}

	.box-my-signature {
		background-color: rgb(246, 245, 250);
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 100vw;
		z-index: 999;
		position: fixed;
		bottom: 0;
		left: 0;
		border-top-left-radius: 30rpx;
		border-top-right-radius: 30rpx;
		overflow: hidden;

		.hide-canvas {
			position: absolute;
			left: 100vh;
		}

		.content {
			background-color: #fff;
			flex: 1;
			width: 100%;
			display: flex;
			flex-direction: column;

			.tip {
				width: 100%;
				height: 64rpx;
				background: #E7F2FE;
				font-family: HarmonyOS Sans SC;
				font-weight: 400;
				font-size: 24rpx;
				color: #0366FF;
				display: flex;
				align-items: center;
				justify-content: center;
			}

			.box-signature {
				display: flex;
				align-items: center;
				flex: 1;

				.btns {
					display: flex;
					flex-direction: column;
					align-items: center;
					justify-content: space-around;
					width: 154rpx;
					height: 100%;
					background: #F5F5F7;
				}

				.btn-rotate {
					transform: rotate(90deg);
				}

				.box-name {
					flex-direction: row;
					display: flex;
					align-items: center;
					word-break: keep-all;
				}

				.box-name-label {
					color: #333333;
					font-size: 30rpx;
					fontWeight: 400;
					margin-right: 20rpx;
					width: 80rpx;
				}

				.btn-1,
				.btn-2 {
					width: 200rpx;
					height: 80rpx;
					line-height: 80rpx;
					font-size: 32rpx;
					color: #333333;
					fontWeight: 400;
					align-items: center;
					justify-content: center;
					text-align: center;
					border-radius: 8rpx;
				}

				.btn-1 {
					background: #FFFFFF;
				}

				.btn-2 {
					background: #0C7FF2;
					color: #fff;
				}

				.box-canvas {
					flex: 1;
					height: 100%;
					background: #F5F5F7;
					position: relative;
					overflow: hidden;
				}

				.box-tip {
					position: absolute;
					top: 0;
					left: 0;
					transform-origin: 0 0;
					display: flex;
					align-items: center;
					justify-content: center;
					color: rgb(236, 236, 236);
					word-break: break-all;
				}

				.box-tip-1 {
					font-size: 340rpx;
					letter-spacing: 160rpx;
				}

				.box-tip-2 {
					font-size: 340rpx;
					letter-spacing: 160rpx;
				}

				.box-tip-3 {
					font-size: 200rpx;
					letter-spacing: 50rpx;
				}

				.box-tip-4 {
					font-size: 240rpx;
					letter-spacing: 80rpx;
				}

				.box-tip-6 {
					font-size: 190rpx;
					letter-spacing: 120rpx;
					padding-left: 60rpx;
					line-height: 250rpx;
				}

				.box-tip-8 {
					font-size: 150rpx;
					letter-spacing: 90rpx;
					padding-left: 40rpx;
					line-height: 250rpx;
				}

				.box-tip-10 {
					font-size: 160rpx;
					letter-spacing: 40rpx;
					padding-left: 40rpx;
					line-height: 250rpx;
				}

				.box-tip-hidden {
					color: rgb(246, 245, 250);
				}

				.canvas-hide {
					opacity: 0;
				}

				.img-signature {
					position: absolute;
					top: 0;
					right: 0;
				}
			}
		}
	}
</style>