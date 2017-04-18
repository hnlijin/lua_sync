sync lua script to simulator

步骤：
1. 安装nodejs, 本工具是基于nodejs. 安装方法： brew install nodejs 或 http://nodejs.cn/download/
2. npm install, 安装nodejs依赖包
3. 启动iOS模拟器
3. 执行脚本sync

注意：
1. 支持lua模块请参考index.js中的features变量, 新模块可以加入数组里。
2. 修改的lua脚本需要及时看到效果，请确认该脚本文件是否包含在相应模块的unload.lua里,
如果没有手动添加，或执行node unload.js自动添加。
3. sync脚本执行过程中报错，需要从新执行sync脚本。


功能:
1. 支持模块脚本修改后代码立即在游戏内起效
2. 支持模拟机断开后定时检测重连