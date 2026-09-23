import React, { useRef, useState } from 'react';
import { Button } from './widgets';
import { TextInput } from './fancy-inputs';
import { useAuth } from './auth-bits';
import { useDebounce } from './timing';
import { isEmail } from './misc-helpers';

/**
 * LoginScreen — email/password form wired to the auth context.
 */
export function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedEmail = useDebounce(email, 300);
  const emailValid = isEmail(debouncedEmail);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (emailValid) void login(email, password);
      }}
    >
      <TextInput ref={inputRef} value={email} placeholder="Email" onChange={setEmail} />
      <TextInput value={password} placeholder="Password" onChange={setPassword} />
      <Button type="primary" disabled={!emailValid} loading={false}>
        Sign in
      </Button>
    </form>
  );
}
