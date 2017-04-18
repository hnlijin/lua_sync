var net = require("net");
var fs = require("fs");
var path = require("path");
const util = require('util');

var project_path = "../../"
var code_dir = path.join(project_path, "frameworks", "runtime-src", "Resources", "localItemResources");
var scripts = "scripts"
var code_scripts = path.join(code_dir, scripts);
var features = ["game", "new_game", "cookhouse", "common_ui", "common", "summon", "tutorial"]

function main()
{
	features.forEach(function(feature_name)
	{
		var code_feature_dir = path.join(code_scripts, feature_name);
		var fileList = [];
		readDirSync(code_feature_dir, fileList);

		var unload_file_path = path.join(code_feature_dir, "unload.lua") 
		var unload_str = "";
		var unload_code = 'package.loaded["%s"] = nil';
		fileList.forEach(function(fn)
		{
			if (fn.indexOf("old") <= 0)
			{
				var base_name = path.basename(fn)
				if (base_name !== "config.lua" &&
				    base_name !== "controller.lua" && base_name !== "launcher.lua" &&
				    base_name != "load.lua" && base_name != "data.lua")
				{
					var f1 = path.relative(code_scripts, fn);
					var ext = path.extname(f1);
					var f2 = f1.replace(ext, "");
					unload_str += util.format(unload_code, f2) + "\n";
				}
			}
		});
		fs.writeFileSync(unload_file_path, unload_str);

		console.log(unload_str);
	});
}

function readDirSync(dir, fileList)
{
	var pa = fs.readdirSync(dir);
	pa.forEach(function(fn, index) {
		var fp = path.join(dir, fn);
		var finfo = fs.statSync(fp);
		if (finfo.isDirectory()) {
			readDirSync(fp, fileList);
		} else {
			var ext = path.extname(fp);
			if (ext == ".lua") {
				fileList.push(fp);
			}
		}
	});
}

main();
