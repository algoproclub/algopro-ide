import * as firebase from 'firebase/auth';

export const signInAnonymously = (): void => {
  firebase.signInAnonymously(firebase.getAuth()).catch(error => {
    const errorCode = error.code;
    const errorMessage = error.message;
    alert('Error signing in: ' + errorCode + ' ' + errorMessage);
  });
};
