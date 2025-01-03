'use client';
import { SignIn } from '@clerk/nextjs';
import React from 'react'
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

const SignInPage = () => {
  const router = useRouter()

  return (
    <main className='flex-center flex min-h-screen w-full flex-col gap-6 bg-auth-light bg-cover bg-center bg-no-repeat dark:bg-auth-dark'>
      <Button onClick={() => router.push("../")}>Back</Button>
      <SignIn forceRedirectUrl={process.env.NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL} />
    </main>
  )
}

export default SignInPage;