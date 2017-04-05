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

var cmd_queue = [];
var cmd_exe_flag = false;
var cache_feature_dict = {};
var scripts = "scripts"
var project_path = process.argv[2]
var code_dir = path.join(project_path, "frameworks", "runtime-src", "Resources", "localItemResources");
var code_scripts = path.join(code_dir, scripts);
var features = ["game", "new_game"]

function watchFeature(feature_name)
{
	var code_feature_dir = path.join(code_scripts, feature_name);
	// 监听文件改变
	fs.watch(code_feature_dir, {
		persistent: true,
		recursive: true
	}, function(eventType, fileName)
	{
		console.log(eventType, fileName);

		var cache_feature_dir = cache_feature_dict[feature_name];
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
					// var unload_cmd = "lua package.loaded['" + path.join(feature_name, base_name) + "'] = nil";
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
	}.bind(this))
}

var client = net.connect(5678, '127.0.0.1', function()
{
	init();
});

client.on('data', function(data)
{
	console.log('data:', data.toString());

	var str = data.toString();
	str = str.replace(">", "");
	str = str.replace(">", "");
	str = str.trim();
	var arr = str.split("|");
	
	if (arr[0] == "feature_dir")
	{
		console.log("\u001B[31m[SET CACHE_DIR]\u001B[0m:", arr[0], arr[1], arr[2]);

		var fkey = arr[1];
		cache_feature_dict[fkey] = {};
		cache_feature_dict[fkey][0] = arr[2];
		cache_feature_dict[fkey][1] = arr[3];
	}

	cmd_exe_flag = false;
	check_cmd_queue();
});

client.on('error', function(err)
{
	console.log('error:', err);

	cmd_exe_flag = false;
	check_cmd_queue();
});

function exe_cmd(cmd)
{
	cmd_queue.push(cmd);
	check_cmd_queue();
}

function check_cmd_queue()
{
	if (cmd_exe_flag == false && cmd_queue.length > 0)
	{
		var cmd = cmd_queue.shift();
		if (cmd != null)
		{
			cmd_exe_flag = true;
			console.log("[EXE_CMD]:", cmd);
			client.write(cmd + "\n");
		}
	}
}

function syncFileWithCP(fn_src, fn_dst)
{
    var readable = fs.createReadStream(fn_src); // 创建读取流
    var writable = fs.createWriteStream(fn_dst);  // 创建写入流
    readable.pipe(writable); // 通过管道来传输流
}

function syncFileWithNC(fn_src, fn_dst)
{
	var str = fs.readFileSync(fn_src, "utf8");
	var b = new Buffer(str, 'base64')
	// var s = b.toString('base64');
	client.write("sync " + fn_dst + "@" + b);
}

function init()
{
	cmd_exe_flag = false;
	features.forEach(function(feature_name)
	{
		exe_cmd("feature_dir " + feature_name);
		watchFeature(feature_name);
	});
}
