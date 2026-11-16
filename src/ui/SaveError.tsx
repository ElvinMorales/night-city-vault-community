export function SaveError({error}:{error:string}){
 if(!error)return null;
 const message=/Saved, but/i.test(error)?'Your change was saved, but the screen could not update. Reload before making another change.':/unsupported-undo/i.test(error)?'This change can no longer be undone. Another change may have been saved. Review Recent Activity.':/conflict/i.test(error)?'Your collection changed in another window. Review the latest quantities before trying again.':/collision/i.test(error)?'That version is already in your catalog. Choose the existing version.':/storage|quota/i.test(error)?'Your browser could not save this change. Check available space, then try again.':'This change could not be saved. Review your choices and try again.';
 return <div className="error" role="alert"><p>{message}</p><details><summary>Error details</summary><p>{error}</p></details></div>;
}
