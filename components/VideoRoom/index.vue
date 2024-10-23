<template>
	<view class="content" id="content">
		<div class="box-navbar" v-if="caseInfoId">
			<div>视频调解室</div>
			<div @click="handleLeave">结束</div>
		</div>
		<div :class="{ 'box-streams': true, 'box-streams-full': fullId }">
			<div v-for="item in remoteList.filter(item => !item.userType)" :key="item.id"
				:class="{ 'box-stream': true, 'box-stream-full': fullId === item.id }" @click="handleSwitchFullId(item.id)">
				<div :id="item.id" style="width: 240rpx;height: 320rpx;">
				</div>
				<div class="bottom">
					<div class="name">{{ item.userId | userNameFilter(that) }}</div>
					<div>({{ item.userType | userTypeFilter }})</div>
				</div>
			</div>
			<div :class="{ 'box-stream': true, 'box-stream-full': fullId === user.userId }"
				@click="handleSwitchFullId(user.userId)">
				<div id="local_stream" style="width: 240rpx;height: 320rpx;"></div>
				<div class="bottom" v-if="localStream">
					<div class="name">{{ user.name }}</div>
					<div>(我)</div>
				</div>
			</div>
			<div v-for="item in remoteList.filter(item => item.userType)" :key="item.id"
				:class="{ 'box-stream': true, 'box-stream-full': fullId === item.id }" @click="handleSwitchFullId(item.id)">
				<div :id="item.id" style="width: 240rpx;height: 320rpx;">
				</div>
				<div class="bottom">
					<div class="name">{{ item.userId | userNameFilter(that) }}</div>
					<div>({{ item.userType | userTypeFilter }})</div>
				</div>
			</div>
		</div>
		<div class="box-controls" v-if="localStream">
			<div @click="handleSwitchCamera">
				<image src="./icons/switch-camera.png"></image>
				<div>切换</div>
			</div>
			<div class="line"></div>
			<div>
				<image src="./icons/mic.png" @click="handleUpdateLocalStream('audio', 'close')" v-if="localAudioStatus">
				</image>
				<image src="./icons/mic-off.png" @click="handleUpdateLocalStream('audio', 'open')" v-else></image>
				<div>静音</div>
			</div>
		</div>
		<div class="box-empty" v-if="!caseInfoId && !isFirstEnterRoom && !loading">
			<image src="./icons/empty.png"></image>
			<div>会议不存在或已结束</div>
		</div>
		<div class="btn-enter" @click="handleEnter" v-if="isFirstEnterRoom">进入调解室</div>
		<MySignature ref="mySignature" :name="user.name" :showBtnClose="true" :needUpload="false"
			@close="handleCloseSignature" @success="handleSignSuccess" v-if="showSignature"
			:fullHeight="windowHeight + 'px'" />
		<!-- 文书列表弹窗 -->
		<u-popup :show="showDocuments" round="20" :safeAreaInsetBottom="false">
			<div :style="{ height: windowHeight + 'px' }" class="box-documents">
				<div class="title">
					<div>文书列表</div>
					<image src="./icons/close.png" class="icon-close" @click="showDocuments = false"></image>
				</div>
				<scroll-view scroll-y class="documents">
					<div v-for="item in documents" :key="'document-' + item.id" class="box-document"
						@click="handlePreviewDocument(item)">
						<image src="./icons/file.png"></image>
						<div>{{ item.documentName }}</div>
						<div :style="{ color: item._color,background: item._background_color }" class="box-status">
							{{ item._status }}
						</div>
					</div>
				</scroll-view>
				<div class="box-btns">
					<div class="btn-sign" type="primary" @click="handlePreviewAll">阅读并批量签字</div>
				</div>
			</div>
		</u-popup>
		<!-- 文书预览弹窗 -->
		<u-popup :show="showPreview" round="20" :safeAreaInsetBottom="false">
			<div class="box-preview" :style="{ height: windowHeight + 'px' }">
				<div class="title">
					<div>{{ documentName }}</div>
					<image src="./icons/close.png" class="icon-close" @click="handleClosePreviewWindow"></image>
				</div>
				<div class="tip">以下内容阅读后，如无异议请签字确认</div>
				<scroll-view scroll-y class="box-imgs">
					<image mode="widthFix" v-for="(item, index) in previewImgs" :key="'img-' + index" :src="item"
						@click="handlePreviewImg(item)">
					</image>
					<div style="min-height: 180rpx;"></div>
				</scroll-view>
				<div class="box-btns" v-if="!documentSigned">
					<div :class="{ 'btn-sign': true, 'btn-sign-disabled': btnSignDisabled }" @click="handleShowSignWindow">
						{{ btnSignText }}
					</div>
				</div>
			</div>
		</u-popup>
	</view>
</template>

<script>
	import TRTC from "trtc-js-sdk";
	import MySignature from '@/components/MySignature/index.vue'
	import * as Apis from '@/apis/index.js'

	let interval = undefined

	export default {
		components: {
			MySignature
		},
		data() {
			return {
				that: this,
				user: {
					userId: "",
					idCard: '',
					name: undefined
				},
				client: undefined,
				localStream: undefined,
				remoteList: [],
				roomId: undefined,
				showSignature: false,
				showDocuments: false,
				documents: [],
				documentId: undefined,
				documentName: undefined,
				documentSigned: false,
				caseInfoId: undefined,
				showPreview: false,
				previewImgs: [],
				btnSignText: '',
				time: 1,
				btnSignDisabled: true,
				topic: undefined,
				localAudioStatus: true,
				localVideoStatus: true,
				localVolumeStatus: true,
				playerList: [],
				isSignAll: false,
				docIds: [],
				cameraType: 'user',
				businessType: 1,
				canSwitchAudio: true,
				windowHeight: 0,
				userList: [],
				isFirstEnterRoom: false,
				loading: false,
				options: {},
				fullId: undefined
			}
		},
		filters: {
			userNameFilter(val, that) {
				const result = that.userList.find((item) => item.id === val);
				return result ? result.userName : "";
			},
			userTypeFilter(val) {
				return val === "1" ? "左屏" : val === "2" ? "右屏" : val === "3" ? "线上" : "调解员";
			},
		},
		onLoad(options) {
			this.options = options || {}
			this.user.userId = options.userId
			this.businessType = Number(options.type || 1)
			if (this.user.userId && this.businessType) {
				this.isFirstEnterRoom = true
			}
		},
		methods: {
			handleSwitchFullId(id) {
				if (this.fullId === id) {
					this.fullId = undefined
				} else {
					this.fullId = id
				}
			},
			handleEnter() {
				this.loading = true
				this.isFirstEnterRoom = false
				if (this.user.userId) {
					const params = (this.businessType === 1 || this.businessType === 3) ? {
						id: this.user.userId
					} : {
						userId: this.user.userId
					}
					const request = this.businessType === 1 ? Apis.login : this.businessType === 3 ? Apis.orgLogin : Apis
						.meetingPeopleLogin

					request(params).then(async res => {
						uni.setStorageSync('token', res.data.token)
						if (this.businessType === 2) {
							this.caseInfoId = res.data.meetingId
							this.topic = '/topic/meeting/' + this.caseInfoId
							await this.loadUserList()
						} else if (this.businessType === 1 || this.businessType === 3) {
							this.caseInfoId = this.options.id
							this.topic = '/topic/video/' + this.caseInfoId
						}
						this.roomId = 'maotiao-' + this.caseInfoId
						this.$mqtt.initMqtt(this.topic, this.user.userId, {
							callback: this.handleMqttMsg
						})
						this.user.name = res.data.userName
						this.user.idCard = res.data.idCard
						this.loading = false
						this.initTrtc()
					}).catch(() => {
						this.loading = false
						this.caseInfoId = undefined
						uni.redirectTo({
							url: '/'
						})
					})
				} else {
					this.loading = false
				}
				const content = document.getElementById('content')
				this.windowHeight = window.innerHeight
				content.style.height = window.innerHeight + 'px'
			},
			loadUserList() {
				return new Promise((resolve, reject) => {
					Apis.queryMeetingPeople({
						meetingId: this.caseInfoId
					}).then(res => {
						this.userList = res.data
						resolve()
					}).catch(reject)
				})
			},
			handleLeave() {
				uni.showModal({
					title: '提示',
					content: '是否确认退出会议室?',
					success: (res) => {
						if (res.confirm) {
							this.leaveRoom()
						}
					}
				})
			},
			handlePreviewAll() {
				this.documentSigned = false
				uni.showLoading({
					title: '加载中',
					mask: true
				})
				Apis.pdfToImage({
					ids: this.documents.map(item => item.id)
				}).then(res => {
					uni.hideLoading()
					this.isSignAll = true
					this.documentName = '阅读文书'
					this.showDocuments = false
					this.showPreview = true
					this.previewImgs = res.data
					this.startInterval(10)
				}).catch(() => {
					uni.hideLoading()
				})
			},
			async leaveRoom() {
				this.caseInfoId = undefined
				this.localStream.close();
				this.client.unpublish(this.localStream);
				await this.client.leave();
				this.client.destroy();
				this.localStream = undefined
				this.client = null;
				this.remoteList = [];
				this.showDocuments = false
				this.showPreview = false
				this.showSignature = false
				this.$mqtt.shutDownMqtt()
				uni.redirectTo({
					url: '/'
				})
			},
			handleMqttMsg(data) {
				if (data.userIds && !data.userIds.includes(this.user.userId)) return
				switch (data.code) {
					case 'quit':
						this.leaveRoom()
						break;
					case 'sign':
						this.docIds = data.docIds
						this.loadDocumentList()
						break;
					case 'openAudio':
						this.handleUpdateLocalStream('audio', 'open')
						break;
					case 'closeAudio':
						this.handleUpdateLocalStream('audio', 'close')
						break;
					case 'openVideo':
						this.handleUpdateLocalStream('video', 'open')
						break;
					case 'closeVideo':
						this.handleUpdateLocalStream('video', 'close')
						break;
					case "stopAllAudio":
						this.handleUpdateLocalStream('audio', 'close')
						this.canSwitchAudio = false;
						break;
					case "cancelStopAllAudio":
						this.canSwitchAudio = true;
						break;
					default:
						break;
				}
			},
			intervalFunc() {
				if (this.time > 0) {
					this.btnSignText = `文书需要阅读${this.time}s`
					this.time -= 1
				} else {
					this.btnSignText = `签字`
					this.btnSignDisabled = false
					clearInterval(interval)
				}
			},
			startInterval(time) {
				clearInterval(interval)
				this.time = time
				this.btnSignDisabled = true
				this.intervalFunc()
				interval = setInterval(this.intervalFunc, 1000)
			},
			handleClosePreviewWindow() {
				this.btnSignText = ''
				clearInterval(interval)
				this.showPreview = false
				this.showDocuments = true
			},
			handlePreviewImg(src) {
				// uni.previewImage({
				// 	urls: this.previewImgs,
				// 	current: src
				// })
			},
			handlePreviewDocument(data) {
				this.isSignAll = false
				this.documentId = data.id
				this.documentName = data.documentName
				// this.documentSigned = data.personSignStatus === 1
				this.documentSigned = true
				this.showDocuments = false
				Apis.pdfToImage({
					ids: [data.id]
				}).then(res => {
					this.showPreview = true
					this.previewImgs = res.data
					this.startInterval(1)
				})
			},
			formatDocumentList(arr) {
				return arr.map(item => {
					const result = {
						...item
					}
					if (result.personSignStatus === 1) {
						result._status = '已签署'
						result._color = '#0366FF'
						result._background_color = '#E7F2FE'
					} else if (result.initSign === 1) {
						result._status = '待签署'
						result._color = '#0366FF'
						result._background_color = '#E7F2FE'
					} else {
						result._status = '阅读'
						result._color = '#0366FF'
						result._background_color = '#E7F2FE'
					}
					return result
				})
			},
			loadDocumentList() {
				Apis.listApplicantsAndDocuments({
					caseInfoId: this.caseInfoId,
					businessType: this.businessType
				}).then(res => {
					const result = res.data.find(item => item.applicantId == this.user.userId)
					if (result) {
						const documentList = result.documentVOList.filter(item => this.docIds.includes(item.id) && item
							.personSignStatus === -1 && item.initSign == 1)
						this.documents = this.formatDocumentList(documentList)
						if (this.documents.length > 0) {
							this.showDocuments = true
						}
						this.user.name = result.applicantName
					}
				})
			},
			handleCloseSignature() {
				this.showSignature = false
				this.showPreview = true
			},
			handleSignSuccess(res) {
				uni.showLoading({
					title: '签名中',
					mask: true
				})
				Apis.signMultiDocument({
					caseInfoId: this.caseInfoId,
					idList: this.documents.map(item => item.id),
					sysUserId: this.user.userId,
					identityCards: this.user.idCard,
					representativeName: this.user.name,
					picFile: res,
				}).then(res => {
					uni.hideLoading()
					uni.showToast({
						title: '签名成功',
						icon: 'success'
					})
					this.showSignature = false
					this.$mqtt.send(
						JSON.stringify({
							topic: this.topic,
							code: "sign-success",
							useName: this.user.name,
						}),
						this.topic
					);
				}).catch(() => {
					uni.hideLoading()
				})
			},
			handleShowSignWindow() {
				if (this.btnSignDisabled) return
				this.showPreview = false
				this.showSignature = true
				this.$nextTick(() => {
					this.$refs.mySignature.initCanvas()
				})
			},
			getUserSig(userId) {
				return new Promise((resolve, reject) => {
					Apis.getUserSig({
						userId,
					}).then(res => {
						resolve(res.data)
					}).catch(reject)
				});
			},
			async initTrtc() {
				const userSig = await this.getUserSig(this.user.userId);
				this.client = TRTC.createClient({
					sdkAppId: 1400454379,
					userId: this.user.userId + "",
					mode: "rtc",
					userSig,
					useStringRoomId: true,
					autoSubscribe: false,
				});
				this.initTrtcEvent(this.client);
				this.joinRoom();
			},
			initTrtcEvent(client) {
				client.on("stream-added", (event) => {
					const remoteStream = event.stream;
					console.log("[trtc]远端流增加: " + remoteStream.getUserId());
					//订阅远端流
					client.subscribe(remoteStream);
					const index = this.remoteList.findIndex(
						(item) => item.userId == remoteStream.getUserId()
					);
					const user = this.userList.find(item => item.id === remoteStream.getUserId())
					const result = {
						id: "remote_stream_" + remoteStream.getUserId(),
						userId: remoteStream.getUserId() + "",
						stream: remoteStream,
						hasAudio: remoteStream.hasAudio(),
						hasVideo: remoteStream.hasVideo(),
						userType: user?.userType
					};
					if (index >= 0) {
						this.remoteList[index] = result;
					} else {
						this.remoteList.push(result);
					}
				});
				client.on("peer-leave", (event) => {
					const userId = event.userId;
					console.log("[trtc]远端用户退房：", userId);
				});
				client.on("stream-subscribed", (event) => {
					const remoteStream = event.stream;
					console.log("[trtc]远端流订阅成功：" + remoteStream.getUserId());
					// 播放远端流，传入的元素 ID 必须是页面里存在的 div 元素
					this.$nextTick(() => {
						remoteStream.play("remote_stream_" + remoteStream.getUserId());
					});
				});
				client.on("stream-removed", (event) => {
					const remoteStream = event.stream;
					console.log("[trtc]远端流停止推流：", remoteStream.getUserId());
					const index = this.remoteList.findIndex((item) => item.userId === remoteStream.getUserId());
					if (index >= 0) {
						this.remoteList.splice(index, 1);
					}
				});
				client.on("mute-audio", (event) => {
					console.log("[trtc]远端流禁用音频：", event.userId);
				});
				client.on("mute-video", (event) => {
					console.log("[trtc]远端流禁用视频：", event.userId);
				});
				client.on("unmute-audio", (event) => {
					console.log("[trtc]远端流启用音频：", event.userId);
				});
				client.on("unmute-video", (event) => {
					console.log("[trtc]远端流启用视频：", event.userId);
				});
			},
			joinRoom() {
				this.client
					.join({
						roomId: this.roomId,
					})
					.then(() => {
						const localStream = TRTC.createStream({
							userId: this.user.userId + "",
							audio: true,
							video: true,
						});
						this.localStream = localStream;
						localStream.play("local_stream");
						localStream
							.initialize()
							.then(() => {
								console.log("initialize localStream success");
								// 本地流初始化成功，可通过Client.publish(localStream)发布本地音视频流
								this.client.publish(localStream);
								this.handleUpdateLocalStream('audio', 'close')
							})
							.catch((error) => {
								console.error("failed initialize localStream " + error);
							});
					});
			},
			// 切换本地麦克风和摄像头开启/关闭
			handleUpdateLocalStream(type, mode) {
				if (!this.localStream) return;
				if (type === "audio") {
					if (mode === "open") {
						// if (!this.canSwitchAudio) {
						// 	uni.showToast({
						// 		title: '会议已全体静音',
						// 		icon: 'none'
						// 	})
						// 	return
						// }
						this.localStream.unmuteAudio();
						this.localAudioStatus = true;
					} else {
						this.localStream.muteAudio();
						this.localAudioStatus = false;
					}
				} else {
					if (mode === "open") {
						this.localStream.unmuteVideo();
						this.localVideoStatus = true;
					} else {
						this.localStream.muteVideo();
						this.localVideoStatus = false;
					}
				}
			},
			handleSwitchCamera() {
				this.cameraType = this.cameraType === 'user' ? 'environment' : 'user'
				this.localStream.switchDevice('video', this.cameraType)
			}
		}
	}
</script>

<style>
	page {
		background: #2D3134;
	}
</style>
<style lang="scss" scoped>
	.content {
		height: 100vh;
	}

	.title {
		width: 100%;
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


	.box-btns {
		padding: 60rpx 0 60rpx 0;

		.btn-sign {
			width: 630rpx;
			height: 90rpx;
			background: #0C7FF2;
			border-radius: 8rpx;
			font-weight: 400;
			font-size: 32rpx;
			color: #FFFFFF;
			margin: auto;
			display: flex;
			align-items: center;
			justify-content: center;
		}

		.btn-sign-disabled {
			background: #DCDDE0;
			color: #B9BBC2;
		}
	}

	.box-streams {
		display: flex;
		flex-wrap: wrap;
		height: calc(100vh - 250rpx);
		overflow-y: auto;
		align-content: flex-start;

		.box-stream {
			margin-left: 10rpx;
			margin-top: 10rpx;
			position: relative;

			.bottom {
				display: flex;
				align-items: center;
				position: absolute;
				bottom: 0;
				width: 100%;
				height: 28px;
				background: rgba(#0d0d0e, 0.5);
				border-radius: 4px;
				padding: 0 10px;
				box-sizing: border-box;

				.name {
					overflow: hidden;
					white-space: nowrap;
					text-overflow: ellipsis;
					max-width: 130rpx;
				}

				div {
					font-weight: 400;
					font-size: 22rpx;
					color: #ffffff;
				}
			}
		}
	}

	.box-streams-full {
		padding-top: 750rpx;
		position: relative;
		height: calc(100vh - 1000rpx);

		.box-stream-full {
			position: absolute;
			top: 0;
			left: 0;

			>div {
				&:first-child {
					width: 750rpx !important;
					height: 750rpx !important;
				}
			}
		}
	}


	.box-bottom {
		height: 250rpx;

		.btns {
			padding: 30rpx 0;

			.btn-exit {
				width: 300rpx;
			}
		}
	}

	.box-documents {
		display: flex;
		flex-direction: column;
		align-items: center;

		.documents {
			flex: 1;
			overflow-y: auto;
			width: 100%;
		}

		.box-document {
			display: flex;
			align-items: center;
			padding: 36rpx 0;
			border-bottom: 2rpx solid rgba(#333333, 0.1);
			margin: 0 58rpx;

			image {
				width: 36rpx;
				height: 36rpx;
				margin-right: 26rpx;
			}

			>div {
				&:first-of-type {
					font-weight: 400;
					font-size: 30rpx;
					color: #333333;
					flex: 1;
					overflow: hidden;
					text-overflow: ellipsis;
					white-space: nowrap;
					word-break: break-all;
				}

				&:nth-of-type(2) {
					margin-left: auto;
					width: 120rpx;
					text-align: center;
				}
			}
		}

		.box-status {
			width: 110rpx;
			height: 48rpx;
			border-radius: 8rpx;
			font-family: HarmonyOS Sans SC;
			font-weight: 400;
			font-size: 24rpx;
			display: flex;
			align-items: center;
			justify-content: center;
		}
	}

	.box-preview {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;

		.tip {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 100%;
			height: 64rpx;
			background: #E7F2FE;
			font-weight: 400;
			font-size: 24rpx;
			color: #0366FF;
		}

		.box-imgs {
			flex: 1;
			width: 100%;
			overflow-y: auto;
			background: #F5F5F7;
			padding: 20rpx 20rpx 0 20rpx;
			box-sizing: border-box;

			image {
				width: calc(100vw - 40rpx);
			}
		}

		.box-btns {
			position: absolute;
			bottom: 60rpx;
			left: 60rpx;
			padding: 0;
		}
	}

	.box-navbar {
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		padding: 24rpx 0;
		background: #212526;

		div {
			font-family: HarmonyOS Sans SC;
			font-weight: 400;
			font-size: 32rpx;
			color: #FFFFFF;

			&:last-child {
				position: absolute;
				right: 30rpx;
				color: #FF515A;
			}
		}
	}

	.box-controls {
		position: fixed;
		width: 272rpx;
		height: 100rpx;
		background: rgba(#000000, 0.3);
		border-radius: 50rpx;
		display: flex;
		align-items: center;
		font-family: HarmonyOS Sans SC;
		font-weight: 400;
		font-size: 24rpx;
		color: #FFFFFF;
		right: 40rpx;
		bottom: 40rpx;
		justify-content: center;

		.line {
			width: 1rpx;
			height: 48rpx;
			background: #FFFFFF;
			opacity: 0.5;
			margin: 0 32rpx;
		}

		>div {

			&:first-child,
			&:last-child {
				display: flex;
				flex-direction: column;
				align-items: center;

				image {
					width: 40rpx;
					height: 40rpx;
					margin-bottom: 8rpx;
				}
			}
		}
	}

	.box-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		color: #ffffff;
		font-size: 30rpx;

		image {
			width: 200rpx;
			height: 200rpx;
			margin-bottom: 30rpx;
		}
	}

	.btn-enter {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 260rpx;
		height: 80rpx;
		background: #0C7FF2;
		border-radius: 8rpx;
		font-weight: 400;
		font-size: 28rpx;
		color: #FFFFFF;
		margin: auto;
		display: flex;
		align-items: center;
		justify-content: center;
	}
</style>