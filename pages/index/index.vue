<template>
	<view>
		<button @click="hadnleShowSign">签字</button>
		<my-signature ref="mySignature"></my-signature>
	</view>
</template>

<script>
	import MySignature from '@/components/MySignature/index.vue'
	export default {
		components: {
			MySignature
		},
		data() {
			return {}
		},
		methods: {
			hadnleShowSign() {
				this.$refs.mySignature.open()
			}
		}
	}
</script>

<style>

</style>