'use client';

import React from 'react';
import type { UIRunState } from './types';
import { Approvals } from './Approvals';

type WSRef = React.MutableRefObject<WebSocket | null>;

type Props = {
  state: UIRunState;
  socket: WSRef;
};

export function ApprovalsBridge({ state, socket }: Props) {
  if (!state.approvals.length) return null;

  const handleResolved = (callIds: string[]) => {
    console.log('Approvals resolved:', callIds);
  };

  return (
    <Approvals
      approvals={state.approvals}
      socket={socket}
      onResolved={handleResolved}
    />
  );
}
