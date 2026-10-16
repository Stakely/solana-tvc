import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

describe('react — hooks and core APIs', () => {
  test.each([
    ['useState', useState],
    ['useEffect', useEffect],
    ['useMemo', useMemo],
    ['useRef', useRef],
    ['useContext', useContext],
    ['createContext', createContext],
  ] as const)('exports %s as a function', (_name, fn) => {
    expect(fn).toBeDefined();
    expect(typeof fn).toBe('function');
  });

  test('exports React as default', () => {
    expect(React).toBeDefined();
    expect(typeof React).toBe('object');
  });
});
