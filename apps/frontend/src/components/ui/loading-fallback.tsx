export function LoadingFallback() {
    return (
        <div className="flex h-64 w-full items-center justify-center">
            <div className="flex items-center space-x-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
                <span className="text-sm text-gray-500">Loading...</span>
            </div>
        </div>
    );
}
