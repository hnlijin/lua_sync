var net = require("net");
var fs = require("fs");
var path = require("path");
var parseString = require('xml2js').parseString;
const util = require('util');

if (process.argv.length < 3)
{
	console.log("\u001B[31m[TIP]\u001B[0m: 第一个参数请传入FightingPet项目根目录");
	return;
}

var ERROR_FLAG = "\u001B[31m[ERROR]\u001B[0m:"
var restartGameCmd = "lua CLuaFeatureManager:callLua('game', 'launcher.lua', 'startupGame', nil)"
var unloadCodeCmd = 'lua require("%s/unload")'
var unloadFileCodeCmd = 'lua package.loaded["%s"] = nil'

var cmd_queue = [];
var cmd_exe_flag = false;
var cache_feature_dict = {};
var scripts = "scripts"
var project_path = process.argv[2]
var code_dir = path.join(project_path, "frameworks", "runtime-src", "Resources", "localItemResources");
var code_scripts = path.join(code_dir, scripts);
var features = ["game", "new_game", "cookhouse", "common_ui", "common", "summon", "tutorial"]
var watchers = [];
var client;
var nc_connect_flag = false;

function watchFeature(feature_name)
{
	var code_feature_dir = path.join(code_scripts, feature_name);
	// 监听文件改变
	return fs.watch(code_feature_dir, {
		persistent: true,
		recursive: true
	}, function(eventType, fileName)
	{
		if (nc_connect_flag == false)
		{
			return;
		}

		console.log(eventType, fileName);

		var cache_feature_dir = cache_feature_dict[feature_name];

		if (cache_feature_dir == null || cache_feature_dir.length == 0)
		{
			console.log(ERROR_FLAG, "feature_dict not found!", cache_feature_dir);
			return;
		}

		var cache_feature_script_dir = cache_feature_dir[0];
		var ret = fs.existsSync(cache_feature_script_dir) // 判断缓存lua feature目录是否存在

		if (ret == true)
		{
			var fn_src = path.join(code_feature_dir, fileName);
			var fn_dst = path.join(cache_feature_script_dir, fileName);

			if (fs.existsSync(fn_dst))
			{
				syncFileWithCP(fn_src, fn_dst);

				var ext_name = path.extname(fileName);
				if (ext_name == ".lua")
				{
					var base_name = fileName.replace(ext_name, "");
					var unload_file = path.join(feature_name, base_name).replace(/\//g, ".");
					var unload_file_cmd = util.format(unloadFileCodeCmd, unload_file);
					exe_cmd(unload_file_cmd);
					var unload_cmd = util.format(unloadCodeCmd, feature_name)
					exe_cmd(unload_cmd);
				}
				exe_cmd(restartGameCmd);
			}
			else
			{
				console.log(ERROR_FLAG, "file not found!", fn_dst, ret);
			}
		}
		else
		{
			if (ret == false) {
				console.log(ERROR_FLAG, "dir not found!", cache_feature_script_dir, ret);
			}
		}
	});
}

function connectNC(cb)
{
	nc_connect_flag = false;
	console.log("正在连接模拟器NC...");

	client = net.connect(5678, '127.0.0.1', function()
	{
		if (cb != null) {
			nc_connect_flag = true;
			console.log("连接模拟器NC成功.");
			cb();
		}
	});

	client.on('data', function(data)
	{
		console.log('data:', data.toString());
		check_cmd_queue(true);

		var str = data.toString();
		str = str.replace(">", "");
		str = str.replace(">", "");
		str = str.trim();
		var arr = str.split("|");
		
		if (arr[0] == "feature_dir")
		{
			console.log("\u001B[31m[UPDATE CACHE_FEATURE_DIR]\u001B[0m:", arr[0], arr[1], arr[2]);

			if (arr[2] == "" || arr[3] == "") {
				console.log("通过模拟器NC获取feature_dir失败，5秒后重新获取!");
				console.log("...");
				var cmd = arr[0] + " " + arr[1];
				setTimeout(function(){
					exe_cmd(cmd);
				}, 5000);
			} else {
				var fkey = arr[1];
				cache_feature_dict[fkey] = {};
				cache_feature_dict[fkey][0] = arr[2];
				cache_feature_dict[fkey][1] = arr[3];
			}
		}
	});

	client.on('error', function(err)
	{
		console.log('error:', err);
		console.log("模拟器NC连接中断，中断后的操作将抛弃，5秒后重新连接NC!");
		console.log("...");

		setTimeout(function() {
			reConnectNC()
		}, 5000)
	});
}

function reConnectNC()
{
	connectNC(function()
	{
		cmd_exe_flag = false;
		cmd_queue = [];
		watchDir();
	});
}

function exe_cmd(cmd)
{
	cmd_queue.push(cmd);
	check_cmd_queue();
}

function check_cmd_queue(reset)
{
	if (cmd_queue.length > 0)
	{
		if (reset == true && cmd_exe_flag == true)
		{
			cmd_queue.shift();
			cmd_exe_flag = false;
		}

		if (cmd_exe_flag == false)
		{
			var cmd = cmd_queue[0];
			if (cmd != null)
			{
				cmd_exe_flag = true;
				console.log("[EXE_CMD]:", cmd);
				client.write(cmd + "\n");
			}
		}
	}
}

function syncFileWithCP(fn_src, fn_dst)
{
	try {
		var readable = fs.createReadStream(fn_src); // 创建读取流
	    var writable = fs.createWriteStream(fn_dst);  // 创建写入流
	    readable.on("error", function(err)
	    {
	    	console.log(ERROR_FLAG, "fn_src err:", fn_src, err);
	    });
	    writable.on("error", function(err)
	    {
	    	console.log(ERROR_FLAG, "fn_dst err:", fn_dst, err);
	    });
	    readable.pipe(writable); // 通过管道来传输流
	} catch(err) {
		console.log(ERROR_FLAG, "copy file error!", fn_dst, ret);
	}
}

function syncFileWithNC(fn_src, fn_dst)
{
	var str = fs.readFileSync(fn_src, "utf8");
	var b = new Buffer(str, 'base64')
	// var s = b.toString('base64');
	client.write("sync " + fn_dst + "@" + b);
}

function watchDir()
{
	if (watchers.length > 0)
	{
		watchers.forEach(function(watcher)
		{
			watcher.close();
		});
		watchers.splice(0, watchers.length);
	}

	features.forEach(function(feature_name)
	{
		exe_cmd("feature_dir " + feature_name);
		var watcher = watchFeature(feature_name);
		watchers.push(watcher);
	});
}

connectNC(function()
{
	cmd_exe_flag = false;
	watchDir();
});
