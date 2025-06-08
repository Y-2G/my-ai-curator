import { NextResponse } from 'next/server';
import type { ApiResponse, PaginationParams } from '@/lib/types';

export function successResponse<T>(
  data: T,
  pagination?: PaginationParams
): NextResponse<ApiResponse<T>> {
  const response: ApiResponse<T> = { 
    success: true,
    data 
  };
  
  if (pagination) {
    response.pagination = pagination;
  }
  
  return NextResponse.json(response);
}

export function errorResponse(
  error: string,
  status: number = 500
): NextResponse<ApiResponse<never>> {
  return NextResponse.json(
    { 
      success: false,
      error 
    },
    { status }
  );
}

export function notFoundResponse(
  resource: string = 'Resource'
): NextResponse<ApiResponse<never>> {
  return errorResponse(`${resource} not found`, 404);
}

export function validationErrorResponse(
  errors: any
): NextResponse<ApiResponse<never>> {
  return NextResponse.json(
    { 
      success: false,
      error: 'Validation failed',
      errors 
    },
    { status: 400 }
  );
}