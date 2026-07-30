import React from 'react';
import Svg, { Defs, ClipPath, Rect, Path } from 'react-native-svg';

/* Kobciye book mark — rounded-square open book: bright-blue left page and
   navy right page split by a light spine, with text lines on each page. */
export default function BookMark({ size = 84, rounded = 22 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 128 128">
      <Defs>
        <ClipPath id="bk">
          <Rect x="0" y="0" width="128" height="128" rx={rounded} />
        </ClipPath>
      </Defs>
      {/* pages */}
      <Rect x="0" y="0" width="60" height="128" fill="#1268D1" clipPath="url(#bk)" />
      <Rect x="68" y="0" width="60" height="128" fill="#0A2E6B" clipPath="url(#bk)" />
      {/* spine */}
      <Rect x="60" y="0" width="8" height="128" fill="#AEB8C8" clipPath="url(#bk)" />
      {/* text lines — left page */}
      <Path d="M18 34h30M18 44h30M18 54h22" stroke="#5B9BE4" strokeWidth="6" strokeLinecap="round" />
      {/* text lines — right page */}
      <Path d="M80 34h30M80 44h30M80 54h22" stroke="#3D5C94" strokeWidth="6" strokeLinecap="round" />
    </Svg>
  );
}
