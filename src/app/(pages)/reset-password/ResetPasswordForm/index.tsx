'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useRouter, useSearchParams } from 'next/navigation'

import { Button } from '../../../_components/Button'
import { Input } from '../../../_components/Input'
import { Message } from '../../../_components/Message'
import { useAuth } from '../../../_providers/Auth'

import classes from './index.module.scss'

type FormData = {
  password: string
  token: string
}

export const ResetPasswordForm: React.FC = () => {
  const [error, setError] = useState('')
  const { resetPassword } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>()

  const onSubmit = useCallback(
    async (data: FormData) => {
      try {
        // Resetting issues a fresh session in the same request, so the
        // customer is signed in on success without a second round trip.
        await resetPassword({ password: data.password, token: data.token })
        router.push('/account?success=Password reset successfully.')
      } catch (_) {
        setError('There was a problem while resetting your password. Please try again later.')
      }
    },
    [router, resetPassword],
  )

  // when Next.js populates token within router,
  // reset form with new token value
  useEffect(() => {
    reset({ token: token || undefined })
  }, [reset, token])

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={classes.form}>
      <Message error={error} className={classes.message} />
      <Input
        name="password"
        type="password"
        label="New Password"
        required
        register={register}
        error={errors.password}
      />
      <input type="hidden" {...register('token')} />
      <Button
        type="submit"
        appearance="primary"
        label="Reset Password"
        className={classes.submit}
      />
    </form>
  )
}
