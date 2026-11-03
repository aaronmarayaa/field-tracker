import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  distanceBetween, displayDistance, displaySpeed, formatDuration, isUsablePoint, movementBetween,
  type TrackPoint,
} from '../src/app/home/tracking.ts';

function point(latitude: number, longitude: number, timestamp = 100000, accuracy = 5): TrackPoint {
  return { latitude, longitude, timestamp, accuracy, speed: null };
}

test('Haversine distance is in meters, including crossings of the date line', () => {
  assert.ok(Math.abs(distanceBetween(point(0, 0), point(0, 1)) - 111194.93) < 1);
  assert.equal(distanceBetween(point(14, 121), point(14, 121)), 0);
  assert.ok(distanceBetween(point(0, 179.999), point(0, -179.999)) < 223);
});

test('only precise, finite, valid GPS coordinates are accepted', () => {
  assert.equal(isUsablePoint(point(14.5, 121)), true);
  for (const invalid of [point(91, 0), point(0, 181), point(NaN, 0), point(0, 0, 1, 51), point(0, 0, 1, -1)]) {
    assert.equal(isUsablePoint(invalid), false);
  }
});

test('small drift, old samples, and implausible GPS jumps do not add distance', () => {
  const start = point(0, 0);
  assert.equal(movementBetween(start, point(0, 0.00001, 110000)), 0);
  assert.equal(movementBetween(start, point(0, 0.001, 99000)), 0);
  assert.equal(movementBetween(start, point(0, 1, 101000)), 0);
  assert.ok(movementBetween(start, point(0, 0.001, 160000)) > 111);
});

test('distance uses traveled segments rather than just start and finish', () => {
  const first = point(0, 0);
  const turn = point(0, 0.001, 160000);
  const finish = point(0.001, 0.001, 220000);
  const traveled = movementBetween(first, turn) + movementBetween(turn, finish);
  assert.ok(traveled > distanceBetween(first, finish));
  assert.ok(Math.abs(traveled - 222.39) < 1);
});

test('metric and imperial conversions preserve the underlying measurements', () => {
  assert.equal(displayDistance(1000, 'km'), 1);
  assert.equal(displayDistance(1609.344, 'mi'), 1);
  assert.equal(displaySpeed(10, 'km'), 36);
  assert.ok(Math.abs(displaySpeed(10, 'mi') - 22.36936) < 0.00001);
});

test('durations include full hours and floor incomplete seconds', () => {
  assert.equal(formatDuration(0), '00:00:00');
  assert.equal(formatDuration(3661.9), '01:01:01');
  assert.equal(formatDuration(-1), '00:00:00');
});
