import { useState } from 'react';

interface RefinementInput {
  file_id: number;
  encryption_key: string;
  refiner_id?: number;
}

interface RefinementResponse {
  // Define specific response properties based on the refinement API response
  success?: boolean;
  result?: unknown;
  error?: string;
}

interface UseDataRefinementReturn {
  refine: (input: RefinementInput) => Promise<RefinementResponse>;
  isLoading: boolean;
  error: Error | null;
  data: RefinementResponse | null;
}

export function useDataRefinement(): UseDataRefinementReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<RefinementResponse | null>(null);

  const refine = async (input: RefinementInput): Promise<RefinementResponse> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/refine', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_id: input.file_id,
          encryption_key: input.encryption_key,
          refiner_id: input.refiner_id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Refinement request failed');
      }

      const responseData = await response.json();
      setData(responseData);
      return responseData;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error occurred');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    refine,
    isLoading,
    error,
    data,
  };
}
