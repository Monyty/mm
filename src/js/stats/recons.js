var recons = execMain(function() {
	var isEnable;
	var titleStr = TOOLS_RECONS_TITLE.split('|');

	var div = $('<div style="font-size:0.9em;" />');
	var reconsClick = $('<div>').append('<a target="_blank" class="exturl click"></a>');
	var table = $('<table class="table">');
	var rangeSelect = $('<select>');
	var methodSelect = $('<select>');
	var requestBack = $('<span class="click" />');
	var tableTh = $('<tr>').append($('<th style="padding:0;">').append(methodSelect),
		'<th>' + titleStr[0] + '</th><th>' + titleStr[1] + '</th><th>' + titleStr[2] + '</th><th>' + titleStr[3] + '</th>');

	function parseMove(moveStr) {
		var movere = /^([URFDLB]w?|[EMSyxz]|2-2[URFDLB]w)(['2]?)@(\d+)$/;
		return movere.exec(moveStr);
	}

	function MoveCounter() {
		this.clear();
	}

	MoveCounter.prototype.push = function(move) {
		var axis = ~~(move / 3);
		var amask = 1 << axis;
		if (axis % 3 != this.lastMove % 3) {
			this.lastMove = axis;
			this.lastPow = 0;
		}
		this.moveCnt += (this.lastPow & amask) == amask ? 0 : 1;
		this.lastPow |= amask;
	}

	MoveCounter.prototype.clear = function() {
		this.lastPow = 0;
		this.lastMove = -3;
		this.moveCnt = 0;
	}

	function getMoveCnt(solution) {
		solution = solution.split(/ +/);
		var c = new mathlib.CubieCube();
		c.ori = 0;
		var cnter = new MoveCounter();
		for (var i = 0; i < solution.length; i++) {
			var effMove = c.selfMoveStr(solution[i], false);
			if (effMove != undefined) {
				cnter.push(effMove);
			}
		}
		return cnter.moveCnt;
	}

	function calcRecons(times, method) {
		if (!times || !times[4] || times[0][0] < 0) {
			return;
		}
		var solution = times[4];
		var c = new mathlib.CubieCube();
		var d = new mathlib.CubieCube();
		c.ori = 0;
		solution = solution[0].split(/ +/);
		for (var i = solution.length - 1; i >= 0; i--) {
			c.selfMoveStr(solution[i], true);
		}
		c.selfConj();
		var facelet = c.toFaceCube();
		var data = []; //[[start, firstMove, end, moveCnt], [start, firstMove, end, moveCnt], ...]
		var cnter = new MoveCounter();
		var startCubieI = new mathlib.CubieCube();
		startCubieI.invFrom(c);
		var tsStart = 0;
		var tsFirst = 0;
		var stepMoves = [];
		var progress = cubeutil.getProgress(facelet, method);
		for (var i = 0; i < solution.length; i++) {
			var effMove = c.selfMoveStr(solution[i], false);
			if (effMove != undefined) {
				tsFirst = Math.min(tsFirst, c.tstamp);
				cnter.push(effMove);
				var axis = ~~(effMove / 3);
				stepMoves.push(["URFDLB".charAt(axis % 6) + " 2'".charAt(effMove % 3), c.tstamp]);
				if (axis >= 6) { // slice move
					stepMoves.push(["DLBURF".charAt(axis % 6) + "'2 ".charAt(effMove % 3), c.tstamp]);
				}
			}
			var curProg = cubeutil.getProgress(c.toFaceCube(), method);
			if (curProg < progress) {
				var transCubie = new mathlib.CubieCube();
				mathlib.CubieCube.EdgeMult(startCubieI, c, transCubie);
				mathlib.CubieCube.CornMult(startCubieI, c, transCubie);
				data[--progress] = [tsStart, tsFirst, c.tstamp, cnter.moveCnt, transCubie, stepMoves];
				while (progress > curProg) {
					data[--progress] = [c.tstamp, c.tstamp, c.tstamp, 0, new mathlib.CubieCube(), []];
				}
				startCubieI.invFrom(c);
				tsStart = c.tstamp;
				cnter.clear();
				stepMoves = [];
				tsFirst = 1e9;
			}
		}
		var stepCount = cubeutil.getStepCount(method);
		var rawMoves = [];
		for (var i = 0; i < stepCount; i++) {
			rawMoves[i] = (data[i] || [])[5] || [];
		}
		return {
			data: data,
			rawMoves: rawMoves.reverse()
		}
	}

	// data = [[name, insp, exec, turn], ...]
	function renderResult(stepData, tidx, isPercent, scramble, solve) {
		var maxSubt = 0;
		var sumSubt = 0;
		var stepSData = [];
		var sDataIdx = [];
		for (var i = 0; i < stepData.length; i++) {
			var subt = stepData[i][1] + stepData[i][2];
			sumSubt += subt;
			var names = stepData[i][0].split('-');
			if (stepSData.length == 0 || stepSData[stepSData.length - 1][0] != names[0]) {
				stepSData.push([names[0], 0, 0, 0]);
			}
			sDataIdx[i] = stepSData.length - 1;
			var lData = stepSData[stepSData.length - 1];
			for (var j = 1; j < 4; j++) {
				lData[j] += stepData[i][j];
			}
			maxSubt = Math.max(lData[1] + lData[2], maxSubt);
		}

		var trTpl =
			'<tr style="$0" data="$1"><td rowspan=2 class="$8" style="padding-bottom:0;padding-top:0;">$1</td><td colspan=4 style="padding:0;">' +
			'<span class="cntbar sty2" style="height:0.2em;float:left;border:none;width:$2%;">&nbsp;</span>' +
			'<span class="cntbar" style="height:0.2em;float:left;border:none;width:$3%;">&nbsp;</span></td></tr>' +
			'<tr style="$0" data="$1">' +
			'<td style="padding-bottom:0;padding-top:0;">$4</td>' +
			'<td style="padding-bottom:0;padding-top:0;">$5</td>' +
			'<td style="padding-bottom:0;padding-top:0;">$6</td>' +
			'<td style="padding-bottom:0;padding-top:0;">$7</td>' +
			'</tr>';

		var str = [];
		var totIns = 0;
		var totExec = 0;
		var totMov = 0;
		var curSIdx = -1;
		for (var i = 0; i < stepData.length; i++) {
			var val = stepData[i];
			totIns += val[1];
			totExec += val[2];
			totMov += val[3];
			var isSuperStep = sDataIdx[i] == sDataIdx[i + 1] && sDataIdx[i] != sDataIdx[i - 1];
			if (isSuperStep) {
				curSIdx = sDataIdx[i];
				var sval = stepSData[curSIdx];
				var trsdata = [
					'',
					sval[0],
					sval[1] / maxSubt * 100,
					sval[2] / maxSubt * 100,
					isPercent ? Math.round(sval[1] / sumSubt * 1000) / 10 + '%' : kernel.pretty(sval[1]),
					isPercent ? Math.round(sval[2] / sumSubt * 1000) / 10 + '%' : kernel.pretty(sval[2]),
					Math.round(sval[3] * 10) / 10,
					sval[3] > 0 && sval[1] + sval[2] > 0 ? Math.round(sval[3] / (sval[1] + sval[2]) * 10000 ) / 10 : 'N/A',
					'click sstep'
				];
				var curTr = trTpl;
				for (var j = 0; j < 9; j++) {
					curTr = curTr.replace(new RegExp('\\$' + j, 'g'), trsdata[j]);
				}
				str.push(curTr);
			}

			var trdata = [
				sDataIdx[i] == curSIdx ? 'display:none;' : '',
				val[0],
				val[1] / maxSubt * 100,
				val[2] / maxSubt * 100,
				isPercent ? Math.round(val[1] / sumSubt * 1000) / 10 + '%' : kernel.pretty(val[1]),
				isPercent ? Math.round(val[2] / sumSubt * 1000) / 10 + '%' : kernel.pretty(val[2]),
				Math.round(val[3] * 10) / 10,
				val[3] > 0 && val[1] + val[2] > 0 ? Math.round(val[3] / (val[1] + val[2]) * 10000 ) / 10 : 'N/A',
				''
			];
			var curTr = trTpl;
			for (var j = 0; j < 9; j++) {
				curTr = curTr.replace(new RegExp('\\$' + j, 'g'),  trdata[j]);
			}
			str.push(curTr);
		}
		var endTr = $('<tr>').append(tidx ? $('<td>').append(requestBack) : $('<td style="padding:0;">').append(rangeSelect),
			'<td>' + (isPercent ? Math.round(totIns / sumSubt * 1000) / 10 + '%' : kernel.pretty(totIns)) + '</td>' +
			'<td>' + (isPercent ? Math.round(totExec / sumSubt * 1000) / 10 + '%' : kernel.pretty(totExec)) + '</td>',
			$('<td>').append((scramble || solve) ? reconsClick : Math.round(totMov * 10) / 10),
			'<td>' + (totMov > 0 && totIns + totExec > 0 ? Math.round(totMov / (totIns + totExec) * 10000 ) / 10 : 'N/A') + '</td>');
		table.empty().append(tableTh);
		tableTh.after(str.join(''), endTr);
		rangeSelect.unbind('change').change(procClick);
		methodSelect.unbind('change').change(procClick);
		table.unbind('click').click(procClick);
		requestBack.text('No.' + tidx);
		if (scramble || solve) {
			reconsClick.children('a').attr('href', 'https://alg.cubing.net/?alg=' + encodeURIComponent(solve) + '&setup=' + encodeURIComponent(scramble)).text(Math.round(totMov * 10) / 10);
		}
	}

	function renderEmpty(isRequest) {
		table.empty().append(tableTh);
		tableTh.after(
			$('<tr>').append(
				isRequest ? $('<td>').append(requestBack) : $('<td style="padding:0;">').append(rangeSelect),
				'<td colspan=4>' + TOOLS_RECONS_NODATA + '</td>')
		);
		rangeSelect.unbind('change').change(procClick);
		methodSelect.unbind('change').change(procClick);
		table.unbind('click').click(procClick);
		requestBack.text('---');
	}

	function execFunc(fdiv, signal) {
		if (!(isEnable = (fdiv != undefined))) {
			return;
		}
		if (/^scr/.exec(signal)) {
			return;
		}
		fdiv.empty().append(div.append(table));
		update();
	}

	function reqRecons(signal, value) {
		if (!isEnable) {
			return;
		}
		var method = methodSelect.val() || 'cf4op';
		var isPercent = method.endsWith('%');
		method = method.replace('%', '');
		var times = value[0];
		var rec = calcRecons(times, method);
		if (!rec) {
			renderEmpty(true);
			return;
		}
		var data = rec.data;
		var steps = cubeutil.getStepNames(method);
		var stepData = [];
		for (var i = steps.length - 1; i >= 0; i--) {
			var curData = data[i] || [0, 0, 0, 0];
			stepData.push([steps[i], curData[1] - curData[0], curData[2] - curData[1], curData[3]]);
		}
		var solve = cubeutil.getPrettyReconstruction(rec.rawMoves, method).prettySolve;
		renderResult(stepData, value[1] + 1, isPercent, times[1], solve);
	}

	function update() {
		if (!isEnable) {
			return;
		}
		var nsolv = stats.getTimesStatsTable().timesLen;
		var nrec = rangeSelect.val();
		if (nrec == 'single') {
			nrec = Math.min(1, nsolv);
		} else if (nrec == 'mo5') {
			nrec = Math.min(5, nsolv);
		} else if (nrec == 'mo12') {
			nrec = Math.min(12, nsolv);
		} else if (nrec == 'mo100') {
			nrec = Math.min(100, nsolv);
		} else {
			nrec = nsolv;
		}
		if (!nrec) {
			renderEmpty(false);
			return;
		}
		var method = methodSelect.val() || 'cf4op';
		var isPercent = method.endsWith('%');
		method = method.replace('%', '');
		var steps = cubeutil.getStepNames(method);
		var nvalid = 0;
		var stepData = [];
		for (var s = nsolv - 1; s >= nsolv - nrec; s--) {
			var rec = stats.getExtraInfo('recons_' + method, s);
			if (!rec) {
				continue;
			}
			var data = rec.data;
			nvalid++;
			for (var i = steps.length - 1; i >= 0; i--) {
				var curData = data[i] || [0, 0, 0, 0];
				var sidx = steps.length - i - 1;
				stepData[sidx] = stepData[sidx] || [steps[i], 0, 0, 0];
				stepData[sidx][1] += curData[1] - curData[0];
				stepData[sidx][2] += curData[2] - curData[1];
				stepData[sidx][3] += curData[3];
			}
		}
		if (nvalid == 0) {
			renderEmpty(false);
			return;
		}
		for (var i = 0; i < steps.length; i++) {
			stepData[i][1] /= nvalid;
			stepData[i][2] /= nvalid;
			stepData[i][3] /= nvalid;
		}
		if (nrec == 1) {
			var solve = cubeutil.getPrettyReconstruction(rec.rawMoves, method).prettySolve;
			renderResult(stepData, null, isPercent, stats.timesAt(nsolv - 1)[1], solve);
		} else {
			renderResult(stepData, null, isPercent);
		}
	}

	function procClick(e) {
		if (e.type == 'change') {
			update();
			return;
		}
		var target = $(e.target);
		if (!target.is('.click') || target.is('.exturl')) {
			return;
		}
		if (!target.is('.sstep')) {
			update();
			return;
		}
		var obj = target.parent();
		var prefix = obj.attr('data') + '-';
		obj = obj.next().next();
		while (obj && obj.attr('data').startsWith(prefix)) {
			obj.toggle();
			obj = obj.next();
		}
	}

	function substepMetric(method, start, end, times, idx) {
		var rec = stats.getExtraInfo('recons_' + method, idx);
		if (!rec) {
			return -1;
		}
		var startTime = (rec.data[start[0]] || [0, 0, 0, 0])[start[1]];
		var endTime = (rec.data[end[0]] || [0, 0, 0, 0])[end[1]];
		return endTime - startTime;
	}

	function cumStepMetric(method, isInsp, times, idx) {
		var rec = stats.getExtraInfo('recons_' + method, idx);
		if (!rec) {
			return -1;
		}
		var ret = 0;
		for (var i = 0; i < rec.data.length; i++) {
			var stepData = rec.data[i] || [0, 0, 0, 0];
			ret += isInsp ? stepData[1] - stepData[0] : stepData[2] - stepData[1];
		}
		return ret;
	}

	$(function() {
		if (typeof tools != "undefined") {
			tools.regTool('recons', TOOLS_RECONS + '>' + 'step', execFunc);
		}
		stats.regUtil('recons', update);
		stats.regExtraInfo('recons_cf4op', function(times) {
			return calcRecons(times, 'cf4op');
		});
		stats.regExtraInfo('recons_roux', function(times) {
			return calcRecons(times, 'roux');
		});
		stats.regExtraInfo('recons_cfop_ct',
			substepMetric.bind(null, 'cf4op', [6, 0], [6, 2]),
			['cross ' + STATS_TIME, kernel.pretty]);
		stats.regExtraInfo('recons_cfop_ft',
			substepMetric.bind(null, 'cf4op', [5, 0], [2, 2]),
			['F2L ' + STATS_TIME, kernel.pretty]);
		stats.regExtraInfo('recons_cfop_ot',
			substepMetric.bind(null, 'cf4op', [1, 0], [1, 2]),
			['OLL ' + STATS_TIME, kernel.pretty]);
		stats.regExtraInfo('recons_cfop_pt',
			substepMetric.bind(null, 'cf4op', [0, 0], [0, 2]),
			['PLL ' + STATS_TIME, kernel.pretty]);
		stats.regExtraInfo('recons_cfop_it',
			cumStepMetric.bind(null, 'cf4op', true),
			['CFOP ' + titleStr[0], kernel.pretty]);
		stats.regExtraInfo('recons_cfop_et',
			cumStepMetric.bind(null, 'cf4op', false),
			['CFOP ' + titleStr[1], kernel.pretty]);
		kernel.regListener('recons', 'reqrec', reqRecons);
		var ranges = ['single', 'mo5', 'mo12', 'mo100', 'all'];
		for (var i = 0; i < ranges.length; i++) {
			rangeSelect.append('<option value="' + ranges[i] + '">' + ranges[i] + '</option>');
		}
		var methods = [['cf4op', 'cfop'], ['roux', 'roux']];
		for (var i = 0; i < methods.length; i++) {
			methodSelect.append('<option value="' + methods[i][0] + '">' + methods[i][1] + '</option>');
			methodSelect.append('<option value="' + methods[i][0] + '%">' + methods[i][1] + '%</option>');
		}
	});

	return {
		calcRecons: calcRecons,
		getMoveCnt: getMoveCnt
	}
});

var caseStat = execMain(function() {
	var isEnable;
	var titleStr = TOOLS_RECONS_TITLE.split('|');

	var div = $('<div style="font-size:0.9em;" />');
	var table = $('<table class="table">');
	var methodSelect = $('<select>');
	var tableTh = $('<tr>').append($('<th colspan=2 style="padding:0;">').append(methodSelect),
		'<th>N</th><th>' + titleStr[0] + '</th><th>' + titleStr[1] + '</th><th>' + titleStr[2] + '</th><th>' + titleStr[3] + '</th>');

	function update() {
		if (!isEnable) {
			return;
		}
		var nsolv = stats.getTimesStatsTable().timesLen;
		var nrec = nsolv;
		var method = methodSelect.val() || 'PLL';
		var ident = cubeutil.getIdentData(method);
		var nvalid = 0;
		var caseCnts = [];
		for (var s = nsolv - 1; s >= nsolv - nrec; s--) {
			var caseData = stats.getExtraInfo('recons_cf4op_' + method, s);
			if (!caseData) {
				continue;
			}
			nvalid++;
			var cur = caseData[0];
			caseCnts[cur] = caseCnts[cur] || [0, 0, 0, 0];
			var cumData = [1].concat(caseData.slice(1));
			for (var i = 0; i < 4; i++) {
				caseCnts[cur][i] += cumData[i];
			}
		}

		var trTpl =
			'<tr><td rowspan=2 style="padding-bottom:0;padding-top:0;">$0</td>' +
			'<td rowspan=2 style="padding:0"><canvas/></td>' +
			'<td rowspan=2 style="padding-bottom:0;padding-top:0;">$1</td>' +
			'<td colspan=4 style="padding:0;">' +
			'<span class="cntbar sty2" style="height:0.25em;float:left;border:none;width:$2%;">&nbsp;</span>' +
			'<span class="cntbar" style="height:0.25em;float:left;border:none;width:$3%;">&nbsp;</span></td></tr>' +
			'<tr>' +
			'<td style="padding-bottom:0;padding-top:0;">$4</td>' +
			'<td style="padding-bottom:0;padding-top:0;">$5</td>' +
			'<td style="padding-bottom:0;padding-top:0;">$6</td>' +
			'<td style="padding-bottom:0;padding-top:0;">$7</td>' +
			'</tr>';

		table.empty().append(tableTh);

		var maxSubt = 0;
		for (var i = ident[2]; i < ident[3]; i++) {
			if (!caseCnts[i]) {
				continue;
			}
			maxSubt = Math.max(maxSubt, (caseCnts[i][1] + caseCnts[i][2]) / caseCnts[i][0]);
		}

		for (var i = ident[2]; i < ident[3]; i++) {
			if (!caseCnts[i]) {
				continue;
			}
			var caseCnt = caseCnts[i];
			var tr = $('<tr>');
			var param = ident[1](i);

			var trdata = [
				param[2],
				caseCnt[0],
				caseCnt[1] / caseCnt[0] / maxSubt * 100,
				caseCnt[2] / caseCnt[0] / maxSubt * 100,
				kernel.pretty(caseCnt[1] / caseCnt[0]),
				kernel.pretty(caseCnt[2] / caseCnt[0]),
				Math.round(caseCnt[3] / caseCnt[0] * 10) / 10,
				Math.round(caseCnt[3] / (caseCnt[1] + caseCnt[2]) * 10000) / 10
			];
			var curTr = trTpl;
			for (var j = 0; j < 8; j++) {
				curTr = curTr.replace(new RegExp('\\$' + j, 'g'), trdata[j]);
			}

			curTr = $(curTr);
			var canvas = curTr.find('canvas');
			canvas.css({
				'width': '2em',
				'height': '2em',
				'display': 'block'
			});
			ident[1](i, canvas);
			table.append(curTr);
		}
		methodSelect.unbind('change').change(procClick);
		if (nvalid == 0) {
			tableTh.after('<tr><td colspan=7>' + TOOLS_RECONS_NODATA + '</td></tr>');
			return;
		}
	}

	function procClick(e) {
		if (e.type == 'change') {
			update();
			return;
		}
	}

	function execFunc(fdiv, signal) {
		if (!(isEnable = (fdiv != undefined))) {
			return;
		}
		if (/^scr/.exec(signal)) {
			return;
		}
		fdiv.empty().append(div.append(table));
		update();
	}

	var c;

	function calcCaseExtra(method, time, idx) {
		var rec = stats.getExtraInfo('recons_cf4op', idx);
		if (!rec) {
			return;
		}
		var ident = cubeutil.getIdentData(method);
		var data = rec.data;
		var sdata = data[ident[4]];
		if (!sdata) {
			return;
		}
		c = c || new mathlib.CubieCube();
		c.invFrom(sdata[4]);
		var cur = ident[0](c.toFaceCube());
		return [cur, sdata[1] - sdata[0], sdata[2] - sdata[1], sdata[3]];
	}

	$(function() {
		if (typeof tools != "undefined") {
			tools.regTool('casestat', TOOLS_RECONS + '>' + 'cases', execFunc);
		}
		stats.regUtil('casestat', update);
		var methods = ['PLL', 'OLL'];
		for (var i = 0; i < methods.length; i++) {
			methodSelect.append('<option value="' + methods[i] + '">' + methods[i] + '</option>');
			stats.regExtraInfo('recons_cf4op_' + methods[i], calcCaseExtra.bind(null, methods[i]));
		}
	});
});
