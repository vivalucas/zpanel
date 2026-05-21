declare namespace HomePage{


    interface State{
        active:string
        spaceId:number // 空间的id
        notesList:Info[]
    }

}

declare namespace HomePage.quest{

    interface LoginRequest{
        username:string
        password:string
        vcode?:string
    }

	interface LoginResponse extends User.Info{
		token :string
	}

    interface ResetPasswordByVCodeRequest extends System.Register.SendRegisterVcodeRquest{
    }

}