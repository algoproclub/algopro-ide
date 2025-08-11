import React from 'react';
import Register from '../../src/components/Register/Register';

export default function DefaultRegister() {
  return <Register handlerURL="/api/handleRegistration" />;
}
