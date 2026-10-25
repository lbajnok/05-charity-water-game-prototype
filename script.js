const game = document.querySelector('#game');

const bucketCount = 6;
const collectionDuration = 60;
const packageCount = 5;
const obstacleCount = 4;
const highScoreStorageKey = 'waterRescueHighScore';
// Each number records a bucket's current treatment cycle: ready, filtered, cleaned, or tested.
let bucketStages = [];
let stockedPackages = [];
let score = 0;
let highScore = loadHighScore();
let bucketStates = [];
let obstacleStates = [];
let animationFrameId;
let selectedStage = null;
let fireworksTimeout;

function loadHighScore() {
	try {
		const savedHighScore = Number(localStorage.getItem(highScoreStorageKey));
		return Number.isFinite(savedHighScore) && savedHighScore > 0 ? savedHighScore : 0;
	} catch (error) {
		console.error('Could not load the saved high score from this browser.', error);
		return 0;
	}
}

function displayHighScore() {
	document.querySelector('#high-score').textContent = highScore;
}

function updateScore(scoreCount) {
	scoreCount.textContent = score;
	if (score > highScore) {
		highScore = score;
		displayHighScore();
		try {
			localStorage.setItem(highScoreStorageKey, highScore);
		} catch (error) {
			console.error('Could not save the new high score in this browser.', error);
		}
	}
}

window.addEventListener('storage', (event) => {
	if (event.key === highScoreStorageKey) {
		const savedHighScore = Number(event.newValue);
		if (Number.isFinite(savedHighScore) && savedHighScore > highScore) {
			highScore = savedHighScore;
			displayHighScore();
		}
	}
});

// Add a short decorative burst when a falling bucket is clicked.
function showFirework(bucket, fallingField) {
	const burst = document.createElement('span');
	burst.className = 'firework-burst';
	burst.setAttribute('aria-hidden', 'true');
	const bucketBounds = bucket.getBoundingClientRect();
	const fieldBounds = fallingField.getBoundingClientRect();
	burst.style.left = `${bucketBounds.left + bucketBounds.width / 2 - fieldBounds.left}px`;
	burst.style.top = `${bucketBounds.top + bucketBounds.height / 2 - fieldBounds.top}px`;

	const sparkDirections = [
		['0px', '-30px'],
		['21px', '-21px'],
		['30px', '0px'],
		['21px', '21px'],
		['0px', '30px'],
		['-21px', '21px'],
		['-30px', '0px'],
		['-21px', '-21px']
	];

	sparkDirections.forEach(([x, y]) => {
		const spark = document.createElement('span');
		spark.className = 'firework-spark';
		spark.style.setProperty('--spark-x', x);
		spark.style.setProperty('--spark-y', y);
		burst.append(spark);
	});

	burst.addEventListener('animationend', () => burst.remove(), { once: true });
	fallingField.append(burst);
}

// Start a fresh round of falling buckets and run the countdown.
function showCollectionScreen() {
	if (animationFrameId) {
		cancelAnimationFrame(animationFrameId);
	}

	score = 0;
	const laneCount = window.innerWidth <= 700 ? 2 : bucketCount;

	game.innerHTML = `
		<section class="intro-row">
			<div>
				<p class="eyebrow">01 / COLLECT</p>
				<h1>Catch every drop.</h1>
				<p class="intro-copy">Catch the falling buckets and avoid the polluted spills.</p>
			</div>
			<p class="progress-count"><span data-score>0</span><br><small>score</small><br><strong data-countdown>${collectionDuration}</strong><small> seconds left</small></p>
		</section>
		<section class="scene collection-scene" aria-label="Dirty water collection area">
			<div class="scene-label"><span class="status-dot"></span> COLLECTION SITE <span class="scene-rule"></span></div>
			<div class="falling-field">
				${Array.from({ length: bucketCount }, (_, index) => `
					<button class="water-container" type="button" data-bucket="${index}" aria-label="Catch falling dirty-water bucket ${index + 1}">
						<span class="barrel" aria-hidden="true"><span class="barrel-rim"></span><span class="barrel-water"></span><img class="barrel-logo" src="img/cw_logo.png" alt=""></span>
						<span class="container-action">Catch <span aria-hidden="true">+</span></span>
					</button>`).join('')}
				${Array.from({ length: obstacleCount }, () => `
					<button class="water-obstacle" type="button" aria-label="Polluted spill obstacle. Clicking it subtracts one point from your score.">
						<span class="test-tube" aria-hidden="true"><span class="test-tube-liquid"></span></span>
					</button>`).join('')}
			</div>
			<div class="ground-line"></div>
		</section>
		<p class="stage-hint">Catch buckets for points. Clicking a red spill costs 1 point.</p>
	`;

	const fallingField = game.querySelector('.falling-field');
	const countdown = game.querySelector('[data-countdown]');
	const scoreCount = game.querySelector('[data-score]');
	const buckets = game.querySelectorAll('[data-bucket]');
	bucketStates = Array.from(buckets, (bucket, index) => {
		const lane = index % laneCount;
		const row = Math.floor(index / laneCount);
		const top = -80 - row * 180 - Math.random() * 160;
		bucket.style.left = `${((lane + 0.5) / laneCount) * 100}%`;
		bucket.style.top = `${top}px`;

		return {
			button: bucket,
			top,
			speed: 70 + Math.random() * 60
		};
	});

	bucketStates.forEach((bucket) => {
		bucket.button.addEventListener('click', () => {
			showFirework(bucket.button, fallingField);
			score += 1;
			bucketStages.push(0);
			updateScore(scoreCount);
			bucket.top = -100 - Math.random() * 180;
			bucket.speed = 70 + Math.random() * 60;
			bucket.button.style.top = `${bucket.top}px`;
		});
	});

	const obstacles = game.querySelectorAll('.water-obstacle');
	obstacleStates = Array.from(obstacles, (obstacle) => {
		const left = 10 + Math.random() * 80;
		const top = -120 - Math.random() * 180;
		obstacle.style.left = `${left}%`;
		obstacle.style.top = `${top}px`;

		return {
			button: obstacle,
			top,
			speed: 90 + Math.random() * 60,
			left
		};
	});

	obstacleStates.forEach((obstacle) => {
		obstacle.button.addEventListener('click', () => {
			score -= 1;
			updateScore(scoreCount);
			obstacle.top = -120 - Math.random() * 180;
			obstacle.speed = 90 + Math.random() * 60;
			obstacle.left = 10 + Math.random() * 80;
			obstacle.button.style.left = `${obstacle.left}%`;
			obstacle.button.style.top = `${obstacle.top}px`;
		});
	});

	const startedAt = performance.now();
	let previousFrame = startedAt;
	function moveBuckets(now) {
		const secondsLeft = collectionDuration - Math.floor((now - startedAt) / 1000);
		countdown.textContent = Math.max(0, secondsLeft);

		if (secondsLeft <= 0) {
				showTreatmentScreen();
			return;
		}

		const secondsPassed = (now - previousFrame) / 1000;
		previousFrame = now;
		bucketStates.forEach((bucket) => {
			bucket.top += bucket.speed * secondsPassed;
			if (bucket.top > fallingField.clientHeight) {
				bucket.top = -100 - Math.random() * 180;
				bucket.speed = 70 + Math.random() * 60;
			}
			bucket.button.style.top = `${bucket.top}px`;
		});

		obstacleStates.forEach((obstacle) => {
			obstacle.top += obstacle.speed * secondsPassed;
			if (obstacle.top > fallingField.clientHeight) {
				obstacle.top = -120 - Math.random() * 180;
				obstacle.speed = 90 + Math.random() * 60;
				obstacle.left = 10 + Math.random() * 80;
				obstacle.button.style.left = `${obstacle.left}%`;
			}
			obstacle.button.style.top = `${obstacle.top}px`;
		});

		animationFrameId = requestAnimationFrame(moveBuckets);
	}

	animationFrameId = requestAnimationFrame(moveBuckets);
}

function moveAllBucketsInStage(sourceStage, nextStage) {
	if (nextStage !== sourceStage + 1) {
		return;
	}

	const bucketsToMove = bucketStages
		.map((bucketStage, bucketIndex) => ({ bucketStage, bucketIndex }))
		.filter(({ bucketStage }) => bucketStage === sourceStage);

	if (bucketsToMove.length === 0) {
		return;
	}

	bucketsToMove.forEach(({ bucketIndex }) => {
		if (bucketStages[bucketIndex] === sourceStage) {
			bucketStages[bucketIndex] = nextStage;
		}
	});

	selectedStage = null;

	if (bucketStages.length > 0 && bucketStages.every((stage) => stage === 3)) {
		showShelfScreen();
	} else {
		showTreatmentScreen();
	}
}

// Show every caught bucket and let the player move each one through all three cycles.
function showTreatmentScreen() {
	const treatmentStages = [
		{ title: 'Ready', detail: 'Drag a bucket to Filter', icon: '00', color: 'ready' },
		{ title: 'Filtered', detail: 'Dirt and debris removed', icon: '01', color: 'filter' },
		{ title: 'Cleaned', detail: 'Water made safe', icon: '02', color: 'clean' },
		{ title: 'Tested', detail: 'Water quality checked', icon: '03', color: 'test' }
	];
	const bucketsTested = bucketStages.filter((stage) => stage === 3).length;
	const bucketTotal = bucketStages.length;

	game.innerHTML = `
		<section class="intro-row">
			<div>
				<p class="eyebrow">02 / TREAT</p>
				<h1>Every bucket gets a clean start.</h1>
				<p class="intro-copy">Move every caught bucket through filter, clean, and test.</p>
			</div>
			<p class="progress-count"><span>${bucketsTested}</span> / ${bucketTotal}<br><small>buckets tested</small></p>
		</section>
		<section class="scene treatment-scene" aria-label="Water treatment plant">
			<div class="scene-label"><span class="status-dot"></span> WATER TREATMENT PLANT <span class="scene-rule"></span></div>
			<div class="treatment-grid">
				${treatmentStages.map((stage, index) => {
					const stageBuckets = bucketStages
						.map((bucketStage, bucketIndex) => ({ bucketStage, bucketIndex }))
						.filter((bucket) => bucket.bucketStage === index);
					return `
						<div class="treatment-lane ${stage.color} ${selectedStage === index ? 'is-selected' : ''}" data-lane="${index}">
							<div class="lane-heading"><span class="station-number">${stage.icon}</span><span class="lane-count">${stageBuckets.length}</span></div>
							<h2 class="station-title">${stage.title}</h2>
							<p class="station-detail">${stage.detail}</p>
							<div class="process-buckets" aria-label="${stageBuckets.length} buckets in ${stage.title}">
								${stageBuckets.map(({ bucketIndex }) => `
									<button class="process-bucket ${selectedStage === index ? 'is-selected' : ''}" type="button" draggable="true" data-process-bucket="${bucketIndex}" data-source-stage="${index}" aria-pressed="${selectedStage === index}" aria-label="Bucket ${bucketIndex + 1}, ${stage.title}. Selects all buckets in this stage; drag to the next stage.">
										<span class="mini-barrel" aria-hidden="true"><span></span><img src="img/cw_logo.png" alt=""></span><span class="process-bucket-number">${bucketIndex + 1}</span>
									</button>`).join('')}
							</div>
						</div>`;
				}).join('')}
			</div>
			<div class="ground-line"></div>
		</section>
		<p class="stage-hint">Click any bucket to highlight all buckets in its stage, then drag them to the next stage square.</p>
		${bucketTotal === 0 ? '<button class="restart-button empty-run-button" type="button" data-empty-run>Continue without buckets</button>' : ''}
	`;

	game.querySelectorAll('[data-process-bucket]').forEach((bucket) => {
		bucket.addEventListener('click', () => {
			selectedStage = Number(bucket.dataset.sourceStage);
			showTreatmentScreen();
		});

		bucket.addEventListener('dragstart', (event) => {
			event.dataTransfer.setData('text/plain', JSON.stringify({
				sourceStage: Number(bucket.dataset.sourceStage)
			}));
		});
	});

	game.querySelectorAll('[data-lane]').forEach((lane) => {
		lane.addEventListener('click', (event) => {
			if (event.target.closest('[data-process-bucket]') || selectedStage === null) {
				return;
			}

			moveAllBucketsInStage(selectedStage, Number(lane.dataset.lane));
		});

		lane.addEventListener('dragover', (event) => {
			event.preventDefault();
			lane.classList.add('drag-ready');
		});

		lane.addEventListener('dragleave', (event) => {
			if (!lane.contains(event.relatedTarget)) {
				lane.classList.remove('drag-ready');
			}
		});

		lane.addEventListener('drop', (event) => {
			event.preventDefault();
			lane.classList.remove('drag-ready');
			const payload = event.dataTransfer.getData('text/plain');
			if (!payload) {
				return;
			}

			const { sourceStage } = JSON.parse(payload);
			moveAllBucketsInStage(sourceStage, Number(lane.dataset.lane));
		});
	});

	const emptyRunButton = game.querySelector('[data-empty-run]');
	if (emptyRunButton) {
		emptyRunButton.addEventListener('click', showShelfScreen);
	}
}

// Each click fills one empty shelf space with a clean water package.
function showFireworks() {
	clearTimeout(fireworksTimeout);
	const existingLayer = document.querySelector('.fireworks-layer');
	if (existingLayer) {
		existingLayer.remove();
	}

	const layer = document.createElement('div');
	layer.className = 'fireworks-layer';
	layer.setAttribute('aria-hidden', 'true');
	document.body.append(layer);

	const colors = ['#ffc907', '#2e9df7', '#159a48', '#ff7a5c', '#8bd1cb', '#f7b2d0'];
	const burstCount = 24;

	for (let index = 0; index < burstCount; index += 1) {
		const burst = document.createElement('span');
		burst.className = 'celebration-burst';
		burst.style.left = `${6 + Math.random() * 88}%`;
		burst.style.top = `${6 + Math.random() * 84}%`;
		burst.style.setProperty('--burst-color', colors[index % colors.length]);
		burst.style.setProperty('--burst-delay', `${(index * 70) / 1000}s`);

		const sparkCount = 10 + Math.floor(Math.random() * 6);
		for (let sparkIndex = 0; sparkIndex < sparkCount; sparkIndex += 1) {
			const angle = (Math.PI * 2 * sparkIndex) / sparkCount;
			const distance = 32 + Math.random() * 58;
			const spark = document.createElement('span');
			spark.className = 'celebration-spark';
			spark.style.setProperty('--spark-x', `${Math.cos(angle) * distance}px`);
			spark.style.setProperty('--spark-y', `${Math.sin(angle) * distance}px`);
			spark.style.setProperty('--spark-color', colors[(index + sparkIndex) % colors.length]);
			burst.append(spark);
		}

		layer.append(burst);
		burst.addEventListener('animationend', (event) => {
			if (event.target === burst) {
				burst.remove();
			}
		}, { once: true });
	}

	fireworksTimeout = setTimeout(() => layer.remove(), 3500);
}

function showShelfScreen() {
	game.innerHTML = `
		<section class="intro-row">
			<div>
				<p class="eyebrow">03 / DELIVER</p>
				<h1>Ready for the shelf.</h1>
				<p class="intro-copy">Package the clean water and place it on the store shelves.</p>
			</div>
			<p class="progress-count"><span>${stockedPackages.length}</span> / ${packageCount}<br><small>packages stocked</small></p>
		</section>
		<section class="scene store-scene" aria-label="Store shelves">
			<div class="scene-label"><span class="status-dot"></span> THE LOCAL STORE <span class="scene-rule"></span></div>
			<div class="shelf-display">
				<div class="shelf-row">
					${Array.from({ length: packageCount }, (_, index) => `
						<button class="shelf-slot ${stockedPackages.includes(index) ? 'is-stocked' : ''}" type="button" data-package="${index}" ${stockedPackages.includes(index) ? 'disabled' : ''} aria-label="${stockedPackages.includes(index) ? 'Clean water package stocked' : `Place package ${index + 1} on shelf`}" aria-pressed="${stockedPackages.includes(index)}">
							${stockedPackages.includes(index) ? '<img src="img/water-can-transparent.png" alt="Clean water package">' : '<span class="empty-slot"><span>+</span><small>PLACE HERE</small></span>'}
						</button>`).join('')}
				</div>
				<div class="shelf-board"><span>GOOD WATER, READY TO GO</span></div>
				<div class="shelf-supports" aria-hidden="true"><span></span><span></span></div>
			</div>
			<div class="package-counter"><img src="img/water-can-transparent.png" alt=""> <span>${packageCount - stockedPackages.length}</span> packages ready to place</div>
			<div class="ground-line"></div>
		</section>
		<p class="stage-hint">Click each empty shelf space to place a clean water package.</p>
		${stockedPackages.length === packageCount ? '<section class="finish-banner"><span class="finish-check">&#10003;</span><div><h2>Journey complete.</h2><p>Clean water is ready for the community.</p></div><button class="restart-button" type="button" data-restart>Play again</button></section>' : ''}
	`;

	if (stockedPackages.length === packageCount) {
		showFireworks();
	}

	game.querySelectorAll('[data-package]').forEach((slot) => {
		slot.addEventListener('click', () => {
			stockedPackages.push(Number(slot.dataset.package));
			showShelfScreen();
		});
	});

	const restartButton = game.querySelector('[data-restart]');
	if (restartButton) {
		restartButton.addEventListener('click', resetGame);
	}
}

function resetGame() {
	bucketStages = [];
	stockedPackages = [];
	score = 0;
	bucketStates = [];
	obstacleStates = [];
	selectedStage = null;
	clearTimeout(fireworksTimeout);
	document.querySelector('.fireworks-layer')?.remove();
	showCollectionScreen();
}

document.querySelector('#reset-game').addEventListener('click', resetGame);

displayHighScore();
showCollectionScreen();
