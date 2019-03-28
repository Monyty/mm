"use strict";

var giikerutil = execMain(function(CubieCube) {

	var connectClick = $('<span></span>');
	var resetClick = $('<span>Reset (Mark Solved)</span>').addClass('click');
	var algCubingClick = $('<a target="_blank">0 move(s)</a>').addClass('click');
	var lastSolveClick = $('<a target="_blank"></a>').addClass('click');
	var canvas = $('<canvas>');
	var connectedStr = 'Connected | ??%';
	var drawState = (function() {
		var faceOffsetX = [1, 2, 1, 1, 0, 3];
		var faceOffsetY = [0, 1, 1, 2, 1, 1];
		var colors = ['#ff0', '#fa0', '#00f', '#fff', '#f00', '#0d0'];
		var width = 30;
		var ctx;

		function face(f, facelet) {
			var offx = 10 / 3 * faceOffsetX[f],
				offy = 10 / 3 * faceOffsetY[f];
			for (var x = 0; x < 3; x++) {
				for (var y = 0; y < 3; y++) {
					image.drawPolygon(ctx, colors["DLBURF".indexOf(facelet[(f * 3 + y) * 3 + x])], [
						[x, x, x + 1, x + 1],
						[y, y + 1, y + 1, y]
					], [width, offx, offy]);
				}
			}
		}

		function drawState() {
			if (!canvas) {
				return;
			}
			if (kernel.getProp('giiVRC')) {
				canvas.hide();
				return;
			}
			colors = kernel.getProp('colcube').match(/#[0-9a-fA-F]{3}/g);
			canvas.show();
			ctx = canvas[0].getContext('2d');
			var imgSize = kernel.getProp('imgSize') / 50;
			canvas.width(39 * imgSize + 'em');
			canvas.height(29 * imgSize + 'em');
			canvas.attr('width', 39 * 3 / 9 * width + 1);
			canvas.attr('height', 29 * 3 / 9 * width + 1);
			for (var i = 0; i < 6; i++) {
				face(i, currentState);
			}
		}
		return drawState;
	})();

	function execFunc(fdiv) {
		if (!fdiv) {
			return;
		}
		connectClick.html(connectedStr).removeClass('click').unbind('click');
		if (!GiikerCube.isConnected()) {
			connectClick.html('Connect').addClass('click').click(init);
		}
		fdiv.empty().append('Giiker: ', connectClick, '<br>')
			.append(resetClick.unbind('click').click(markSolved), '<br>')
			.append('Reconstruction: ', algCubingClick, '<br>')
			.append(lastSolveClick, '<br>')
			.append(canvas);
		drawState();
	}

	var batId = 0;

	function updateBattery() {
		if (GiikerCube.isConnected()) {
			GiikerCube.getBatteryLevel().then(function(value) {
				connectedStr = 'Connected | ' + value + '%';
				connectClick.html(connectedStr);
			});
			batId = setTimeout(updateBattery, 60000);
		} else {
			batId = 0;
		}
	}

	var callback = $.noop;

	var currentRawState = mathlib.SOLVED_FACELET;
	var currentRawCubie = new CubieCube();
	var currentCubie = new CubieCube();
	var currentState = currentRawState;
	var solvedStateInv = new CubieCube();
	var scrambledCubie = new CubieCube();

	var lastTimestamp = $.now();
	var detectTid = 0;

	function giikerErrorDetect() {
		if (detectTid) {
			clearTimeout(detectTid);
			detectTid = 0;
		}
		if (kernel.getProp('giiAED')) {
			detectTid = setTimeout(function() {
				if (checkMoves(movesAfterSolved) == 99) {
					return;
				}
				// if (!simpleErrorDetect(currentCubie)) {
				// 	return;
				// }
				var facelet = currentCubie.toFaceCube();
				if (cubeutil.getCFOPProgress(facelet) <= 2) { // all unsolved pieces is on same face
					return;
				}
				var gen = scramble_333.genFacelet(currentCubie.toFaceCube());
				if (gen.length / 3 < 10) {
					console.log('Possible error, gen=' + gen.replace(/ /g, '') + ', ignore');
					return;
				}
				console.log('Almost error, gen=' + gen.replace(/ /g, '') + ', mark solved');
				markSolved();
			}, 1000);
		}
	}

	var nodeSearchd = 0;

	function checkMoves(moves) {
		if (moves.length % 2 == 1) {
			return 99;
		}
		var timespend = [];
		var stateToEnd = [];
		stateToEnd[moves.length] = new CubieCube();
		for (var i = moves.length - 1; i >= 0; i--) {
			stateToEnd[i] = new CubieCube();
			CubieCube.CubeMult(CubieCube.moveCube[moves[i]], stateToEnd[i + 1], stateToEnd[i]);
		}
		for (var i = 1; i < 3; i++) {
			nodeSearchd = 0;
			if (checkSwap(moves, 0, i, new CubieCube(), stateToEnd)) {
				return i;
			} else if (nodeSearchd > 9999) {
				return 99;
			}
		}
		return 99;
	}

	function checkSwap(moves, start, nswap, stateFromStart, stateToEnd) {
		if (nswap == 0) {
			return stateFromStart.isEqual(new CubieCube().invFrom(stateToEnd[start]));
		}
		var cctmp = new CubieCube();
		for (var i = start; i < moves.length - 1; i++) {
			// try to swap moves[i] and moves[i + 1]
			if (~~(moves[i] / 3) % 3 == ~~(moves[i + 1] / 3) % 3) {
				CubieCube.CubeMult(stateFromStart, CubieCube.moveCube[moves[i]], cctmp);
				stateFromStart.init(cctmp.ca, cctmp.ea);
				continue;
			}
			var state = new CubieCube().init(stateFromStart.ca, stateFromStart.ea);
			CubieCube.CubeMult(state, CubieCube.moveCube[moves[i + 1]], cctmp);
			CubieCube.CubeMult(cctmp, CubieCube.moveCube[moves[i]], state);
			CubieCube.CubeMult(state, stateToEnd[i + 2], cctmp);
			if (++nodeSearchd > 9999) {
				return false;
			}
			if (cctmp.edgeCycles() < nswap) {
				var ret = checkSwap(moves, i + 2, nswap - 1, state, stateToEnd);
			}
			if (ret) {
				return true;
			}
			CubieCube.CubeMult(stateFromStart, CubieCube.moveCube[moves[i]], cctmp);
			stateFromStart.init(cctmp.ca, cctmp.ea);
		}
		return false;
	}

	function markSolved() {
		//mark current state as solved
		solvedStateInv.invFrom(currentRawCubie);
		currentState = mathlib.SOLVED_FACELET;
		kernel.setProp('giiSolved', currentRawState);
		movesAfterSolved = [];
		rawMoves = "";
		scrambleLength = 0;
		drawState();
		callback(currentState, ['U '], lastTimestamp);
	}

	var movesAfterSolved = [];
	var rawMoves = "";

	var rotation = {
		x: {
			"R": "R", "L": "L",

			"U": "B", "D": "F",

			"F": "U", "B": "D"
		},
		y: {
			"R": "F", "L": "B",

			"U": "U", "D": "D",

			"F": "L", "B": "R"
		},
		z: {
			"R": "D", "L": "U",

			"U": "R", "D": "L",

			"F": "F", "B": "B"
		},
		id: {
			"R": "R", "L": "L",

			"U": "U", "D": "D",

			"F": "F", "B": "B"
		}
	};

	function rotate(rot, rot2) {
		var result = {};
		for(var i = 0; i < keys.length; i++) {
			var key = keys[i];
			result[key] = rot2[rot[key]];
		}
		return result;
	}

	var keys = ["R", "L", "U", "D", "F", "B"];

	function getPrettyMoves(rawAlgs) {
		var rot = $.extend({}, rotation.id);
		return rawAlgs.map(function (rawMoves) {
			var result = "";
			for (var i = 0; i < rawMoves.length; i += 2) {
				var move1 = rot[rawMoves[i]];
				var dir1 = rawMoves[i + 1];

				if (i + 3 < rawMoves.length) {
					var move2 = rot[rawMoves[i + 2]];
					var dir2 = rawMoves[i + 3];

					var seq = move1 + dir1 + move2 + dir2;
					if (seq === "L R'" || seq === "R'L ") {
						i += 2;
						result += "M'";
						rot = rotate(rot, rotation.x);
					} else if (seq === "L'R " || seq === "R L'") {
						i += 2;
						result += "M ";
						rot = rotateBar(rot, rotation.x);
					} else if (seq === "D U'" || seq === "U'D ") {
						i += 2;
						result += "E'";
						rot = rotate(rot, rotation.y);
					} else if (seq === "D'U " || seq === "U D'") {
						i += 2;
						result += "E ";
						rot = rotateBar(rot, rotation.y);
					} else if (seq === "B F'" || seq === "F'B ") {
						i += 2;
						result += "S ";
						rot = rotate(rot, rotation.z);
					} else if (seq === "B'F " || seq === "F B'") {
						i += 2;
						result += "S'";
						rot = rotateBar(rot, rotation.z);
					} else {
						result += move1 + dir1;
					}
				} else {
					result += move1 + dir1;
				}

			}
			// double moves
			return result.replace(/(([A-Z])[' ])\1/g, "$22");
		});
	}

	function rotateBar(rot, rot2) {
		return rotate(rotate(rotate(rot, rot2), rot2), rot2);
	}

	function getMoveCount(prettyMoves) {
		return prettyMoves.length / 2
	}

	function giikerCallback(facelet, prevMoves) {
		var lastTimestamp = $.now();
		connectClick.html(connectedStr).removeClass('click').unbind('click');
		currentRawState = facelet;
		currentRawCubie.fromFacelet(currentRawState);
		CubieCube.EdgeMult(solvedStateInv, currentRawCubie, currentCubie);
		CubieCube.CornMult(solvedStateInv, currentRawCubie, currentCubie);
		currentState = currentCubie.toFaceCube();

		movesAfterSolved.push("URFDLB".indexOf(prevMoves[0][0]) * 3 + " 2'".indexOf(prevMoves[0][1]));

		rawMoves += prevMoves[0];
		var prettyAlg = getPrettyMoves([rawMoves.substring(0, scrambleLength),rawMoves.substring(scrambleLength)]);
		var moveCount = getMoveCount(prettyAlg.join(""));
		if (moveCount > 5) {
			updateAlgClick(algCubingClick, moveCount + ' move(s)', prettyAlg[0], prettyAlg[1])
		}
		if (currentState == mathlib.SOLVED_FACELET) {
			movesAfterSolved = [];
			rawMoves = "";
			scrambleLength = 0;
		}
		drawState();
		batId == 0 && updateBattery();
		giikerErrorDetect();
		callback(currentState, prevMoves, lastTimestamp);
	}

	function updateAlgClick(click, text, setup, alg) {
		click.attr('href',
			'https://alg.cubing.net/?alg=' + alg
			+ '&setup=' + setup
		);
		click.html(text);
	}

	function setLastSolve(solve) {
		updateAlgClick(lastSolveClick, "Last solve", curScramble, solve)
	}

	function init() {
		currentRawState = kernel.getProp('giiSolved', mathlib.SOLVED_FACELET);
		currentRawCubie.fromFacelet(currentRawState);
		solvedStateInv.invFrom(currentRawCubie);
		GiikerCube.setCallBack(giikerCallback);
		if (!GiikerCube.isConnected()) {
			return GiikerCube.init();
		}
	}

	function checkScramble() {
		if (curScramble == "") {
			return false;
		}
		return scrambledCubie.isEqual(currentCubie);
	}

	var curScramble;

	function procScramble(signal, value) {
		var scrType = value[0];
		curScramble = value[1];
		if (tools.puzzleType(scrType) != '333') {
			curScramble = "";
			return;
		}
		var scr = kernel.parseScramble(curScramble, "URFDLB");
		var cd = new CubieCube();
		scrambledCubie.init(cd.ca, cd.ea);
		for (var i = 0; i < scr.length; i++) {
			var m = scr[i][0] * 3 + scr[i][2] - 1;
			if (m < 0 || m >= 18) {
				continue;
			}
			CubieCube.EdgeMult(scrambledCubie, CubieCube.moveCube[m], cd);
			CubieCube.CornMult(scrambledCubie, CubieCube.moveCube[m], cd);
			var tmp = scrambledCubie;
			scrambledCubie = cd;
			cd = tmp;
		}
	}

	var scrambleLength = 0;

	function markScrambled() {
		scrambleLength = rawMoves.length;
	}

	$(function() {
		kernel.regListener('giiker', 'scramble', procScramble);
		kernel.regListener('tool', 'property', drawState, /^(?:giiVRC)$/);
		tools.regTool('giikerutil', TOOLS_GIIKER, execFunc);
	});

	return {
		setCallBack: function(func) {
			callback = func;
		},
		markSolved: markSolved,
		checkScramble: checkScramble,
		markScrambled: markScrambled,
		init: init,
		getPrettyMoves: getPrettyMoves,
		getMoveCount: getMoveCount,
		setLastSolve: setLastSolve,
	}
}, [mathlib.CubieCube]);