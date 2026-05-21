declare namespace Login{

    interface LoginRequest{
        username:string 
        password:string
        vcode?:string
        email?:string
    }

	interface LoginResponse extends User.Info{
		token :string
	}

    interface ResetPasswordByVCodeRequest extends System.Register.SendRegisterVcodeRquest{
    }

}
